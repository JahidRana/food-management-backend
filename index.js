require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.m2lzn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const logger = (req, res, next) => {
  console.log("log: info", req.method, req.url);
  next();
};

const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token;
  console.log("token in the middleware", token);

  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.user = decoded;
    next();
  });
};

async function run() {
  try {
    // Connect to MongoDB
    await client.connect();

    // Ping the database to verify connection
    await client.db("admin").command({ ping: 1 });
    console.log("Connected to MongoDB successfully!");

    const foodCollection = client.db("foodDB").collection("foods");
    const foodRequestCollection = client.db("foodDB").collection("foodRequest");

    app.post("/jwt", logger, async (req, res) => {
      const user = req.body;
      console.log("user for token", user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });

      res
        .cookie("token", token, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
        })
        .send({ success: true });
    });

    app.post("/logout", async (req, res) => {
      const user = req.body;
      console.log("logging out", user);
      res
        .clearCookie("token", { maxAge: 0, sameSite: "none", secure: true })
        .send({ success: true });
    });

    app.get("/foods", async (req, res) => {
      const cursor = foodCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/foodsCount", async (req, res) => {
      const count = await foodCollection.estimatedDocumentCount();
      res.send({ count });
    });

    app.get("/food/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await foodCollection.findOne(query);
      res.send(result);
    });

    // app.get("/foodRequest", logger, verifyToken, async (req, res) => {
    //   if (req.user.email !== req.query.email) {
    //     return res.status(403).send({ message: "forbidden access" });
    //   }
    //   let query = {};
    //   if (req.query?.email) {
    //     query = { email: req.query.email };
    //   }

    //   const cursor = foodRequestCollection.find(query);
    //   const result = await cursor.toArray();
    //   res.send(result);
    // });

    app.get("/foodRequest", logger, verifyToken, async (req, res) => {
      if (req.user.email !== req.query.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
    
      // Adjust query to match 'userEmail' instead of 'email'
      let query = {};
      if (req.query?.email) {
        query = { userEmail: req.query.email }; // Use 'userEmail' here
      }
    
      const cursor = foodRequestCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
    

    app.get("/foodRequest/:id", logger, verifyToken, async (req, res) => {
      if (req.user.email !== req.query.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const id = req.params.id;
      const queryId = { _id: new ObjectId(id) };
      const result = await foodRequestCollection.findOne(queryId);
      res.send(result);
    });

    app.post("/foods", async (req, res) => {
      const newFoods = req.body;
      console.log(newFoods);
      const result = await foodCollection.insertOne(newFoods);
      res.send(result);
    });

    app.put("/food/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedFood = req.body;
      const food = {
        $set: {
          name: updatedFood.name,
          image: updatedFood.image,
          location: updatedFood.location,
          time: updatedFood.time,
          notes: updatedFood.notes,
        },
      };
      const result = await foodCollection.updateOne(filter, food, options);
      res.send(result);
    });

    app.put("/foodRequest/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedFoodStatus = req.body;
      const food = {
        $set: {
          status: updatedFoodStatus.status,
        },
      };
      const result = await foodRequestCollection.updateOne(
        filter,
        food,
        options
      );
      res.send(result);
    });

    app.post("/foodRequest", async (req, res) => {
      const requestFood = req.body;
      const result = await foodRequestCollection.insertOne(requestFood);
      res.send(result);
    });

    app.delete("/foods/:id", async (req, res) => {
      const id = req.params.id;
      const queryId = { _id: new ObjectId(id) };
      const result = await foodCollection.deleteOne(queryId);
      res.send(result);
    });

    app.delete("/foodRequest/:id", async (req, res) => {
      const id = req.params.id;
      const queryId = { _id: new ObjectId(id) };
      const result = await foodRequestCollection.deleteOne(queryId);
      res.send(result);
    });

  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
  } finally {
    // Optionally close the connection if needed
    // await client.close();
  }
}

// Run the server
run().catch(console.dir);

// Health check endpoint
app.get("/", (req, res) => {
  res.send("Food sharing Server is running");
});

// Start listening
app.listen(port, () => {
  console.log(`Food sharing Server is running on Port ${port}`);
});

// Handle server shutdown
process.on('SIGINT', async () => {
  console.log('Closing MongoDB connection...');
  await client.close();
  process.exit(0);
});
