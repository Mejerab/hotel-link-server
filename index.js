const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const app = express();
const port = process.env.PORT || 5000;
app.use(cors({
  origin: [
    'http://localhost:5173'
  ],
  credentials: true
}))
app.use(express.json())
app.use(cookieParser())

// MongoDB
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xegw8vb.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// Middleware
const logger = (req, res, next) => {
  console.log('Page info:', req.hostname, req.url);
  next();
}
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  console.log('TOKEN:', token);
  if (!token) {
    return res.status(401).send({ message: 'Unauthorized Access' })
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decode) => {
    if (err) {
      return res.status(403).send({ message: 'Unauthorized Access' })
    }
    req.user = decode
    next();
  })
}
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production' ? false : true,
  sameTime: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const roomsCollection = client.db('hotelDB').collection('rooms');
    const messageCollection = client.db('hotelDB').collection('messages');
    const bookingCollection = client.db('hotelDB').collection('bookings');
    const reviewsCollection = client.db('hotelDB').collection('reviews');

    // Auth related api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      console.log('User in use', user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.cookie('token', token)
        .send({ success: true })
    })
    app.post('/logout', async (req, res) => {
      const user = req.body;
      console.log("Logging out user", user);
      res.clearCookie('token', { ...cookieOptions, maxAge: 0 }).send({ success: true });
    })

    // Service related api
    app.get('/rooms', async (req, res) => {
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      const condition = req.query.condition;
      if (!condition) {
        const result = await roomsCollection.find()
          .skip(page * size)
          .limit(size)
          .toArray();
        res.send(result);
      }
      else {
        let sorting = null;
        if (condition === 'mixed') {
          sorting = null;
        }
        else if (condition === 'inorder') {
          sorting = { price_per_night: 1 }
        }
        else {
          sorting = { price_per_night: -1 }
        }
        const result = await roomsCollection.find()
          .skip(page * size)
          .limit(size)
          .sort(sorting)
          .toArray();
        res.send(result);
      }
    })
    // Rooms
    app.get('/rooms/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await roomsCollection.findOne(query);
      res.send(result);
    })
    app.put('/rooms/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const update = req.body;
      console.log(update, filter);
      const updatedList = {
        $set: {
          availability: update.availability
        }
      }
      const result = await roomsCollection.updateOne(filter, updatedList);
      res.send(result);
    })
    app.get('/roomcount', async (req, res) => {
      const count = await roomsCollection.estimatedDocumentCount();
      res.send({ count });
    })

    // Reviews
    app.post('/reviews', async(req, res)=>{
      const query = req.body;
      const result = await reviewsCollection.insertOne(query);
      res.send(result);
  })
  app.get('/reviews', async(req, res)=>{
    const result = await reviewsCollection.find().toArray();
    res.send(result);
  })
  app.get('/reviews/:id', async(req, res)=>{
    const id = req.params.id;
    const query = {_id: new ObjectId(id)};
    const result = await reviewsCollection.findOne(query);
    res.send(result);
  })

    // Messages
    app.post('/messages', async (req, res) => {
      const message = req.body;
      console.log(message);
      const result = await messageCollection.insertOne(message);
      res.send(result);
    })
    app.get('/messages', async (req, res) => {
      const result = await messageCollection.find().toArray();
      res.send(result);
    })

   

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Hotel Link in running')
})
app.listen(port, () => {
  console.log(`Server is running on ${port}`);
})