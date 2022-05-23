const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express();
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.biwlr.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect();

        const partscollection = client.db("authentic-parts").collection("parts");

        app.get('/parts', async (req, res) => {
            const query = {};
            const cursor = partscollection.find(query);
            const parts = await cursor.toArray();

            res.send(parts);
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