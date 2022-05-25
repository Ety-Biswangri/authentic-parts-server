const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.biwlr.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'unauthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden access' });
        }
        req.decoded = decoded;
        next();
    });

}

async function run() {
    try {
        await client.connect();

        const partscollection = client.db("authentic-parts").collection("parts");
        const usersCollection = client.db("authentic-parts").collection("users");
        const ordersCollection = client.db("authentic-parts").collection("orders");
        const paymentsCollection = client.db("authentic-parts").collection("payments");
        const reviewsCollection = client.db("authentic-parts").collection("reviews");

        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await usersCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                next();
            }
            else {
                res.status(403).send({ message: 'forbidden' });
            }
        }

        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const order = req.body;
            const price = order.orderPrice;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card'],
            })
            res.send({ clientSecret: paymentIntent.client_secret });
        })

        app.get('/parts', async (req, res) => {
            const query = {};
            const cursor = partscollection.find(query);
            const parts = await cursor.toArray();
            const reverseParts = parts.reverse();

            res.send(reverseParts);
        })

        app.get('/parts/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const part = await partscollection.findOne(query);

            res.send(part);
        })

        app.post('/parts', verifyJWT, verifyAdmin, async (req, res) => {
            const newProduct = req.body;
            const result = await partscollection.insertOne(newProduct);

            res.send(result);
        })

        app.delete('/parts/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await partscollection.deleteOne(filter);

            res.send(result);
        })

        // makeAdmin
        app.get('/user', verifyJWT, async (req, res) => {
            const users = await usersCollection.find().toArray();
            // console.log(users)
            res.send(users);
        })

        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updateDoc = {
                $set: { role: 'admin' }
            }
            const result = await usersCollection.updateOne(filter, updateDoc);

            res.send(result);
        })

        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user
            }
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '2d' });

            res.send({ result, token });
        })

        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await usersCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';

            res.send({ admin: isAdmin });
        })

        // purchase
        app.get('/order', verifyJWT, async (req, res) => {
            const customerEmail = req.query.customerEmail;
            const decodedEmail = req.decoded.email;

            if (customerEmail === decodedEmail) {
                const query = { customerEmail: customerEmail };
                const orders = await ordersCollection.find(query).toArray();

                return res.send(orders);
            }
            else {
                return res.status(403).send({ message: 'forbidden access' });
            }

        })

        app.get('/order/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const order = await ordersCollection.findOne(query);

            res.send(order);
        })

        // purchase
        app.post('/order', async (req, res) => {
            const order = req.body;
            const result = await ordersCollection.insertOne(order);

            return res.send(result);
        })

        app.patch('/order/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) };
            const updateDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }

            const result = await paymentsCollection.insertOne(payment);
            const updatedOrder = await ordersCollection.updateOne(filter, updateDoc);

            res.send(updateDoc);
        })


        app.get('/review', verifyJWT, async (req, res) => {
            const reviews = await reviewsCollection.find().toArray();
            const reverseReviews = reviews.reverse();
            res.send(reviews);
        })

        app.post('/review', verifyJWT, async (req, res) => {
            const review = req.body;
            const result = await reviewsCollection.insertOne(review);

            res.send(result);
        })
    }
    finally {

    }
}

run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Hello From Authentic Parts!');
});

app.listen(port, () => {
    console.log(`Authentic Parts app listening on port ${port}`);
});