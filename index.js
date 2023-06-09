const express = require('express');
const cors = require('cors');
const app = express();
const jwt = require('jsonwebtoken');
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;


const corsOptions = {
    origin: '*',
    credentials: true,
    optionSuccessStatus: 200,
}
app.use(cors(corsOptions))
app.use(express.json());


// jwt..............st

const verifyJwt = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'Unauthorized Access' })
    }

    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'Unauthorized Access' })
        };
        req.decoded = decoded;
        next();
    })
}

// jwt.......end

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ngcnpjb.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        await client.connect();

        const usersCollection = client.db('danceDB').collection('users');
        const classCollection = client.db('danceDB').collection('classes')
        const selectClassCollection = client.db('danceDB').collection('selectedClass')
        // jwt.......

        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ token })
        })

        // jwt......end


        // all users...........start.....

        app.get('/users', verifyJwt, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result)
        })

        app.get('/users/admin/:email', verifyJwt, async (req, res) => {
            const email = req.params.email;
            const query = { email: email };

            if (req.decoded.email !== email) {
                res.send({ admin: false })
            }

            const user = await usersCollection.findOne(query);
            const result = { admin: user?.role === 'admin' }
            res.send(result)
        })


        app.get('/users/instructor/:email', verifyJwt, async (req, res) => {
            const email = req.params.email;
            const query = { email: email };

            if (req.decoded.email !== email) {
                res.send({ instructor: false })
            }

            const user = await usersCollection.findOne(query);
            const result = { instructor: user?.role === 'instructor' }
            res.send(result)
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const existingUser = await usersCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exist' })
            }
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })


        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            };
            const result = await usersCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })
        app.patch('/users/instructor/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: 'instructor'
                }
            };
            const result = await usersCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        // all users.......end.....

        // classes...st...

        app.get('/classes', async (req, res) => {
            const result = await classCollection.find().toArray();
            res.send(result);
        })

        app.get('/email', async (req, res) => {
            try {
                const email = req.query.email;
                const query = { instructorEmail: email };
                const user = await classCollection.find(query).toArray();
                res.send(user);
            } catch (error) {
                console.error(error);
                res.status(500).send('Internal Server Error');
            }
        });

        app.get('/approvedClasses', async (req, res) => {
            try {
                const result = await classCollection.find({ status: 'approved' }).toArray();
                res.send(result);
            } catch (error) {
                console.error('Error fetching approved classes:', error);
                res.status(500).json({ message: 'Internal Server Error' });
            }
        });


        app.post('/classes', async (req, res) => {
            const classes = req.body;
            const result = await classCollection.insertOne(classes);
            res.send(result);
        })


        app.post("/classes/:classId/deny", verifyJwt, async (req, res) => {
            try {
                const classId = req.params.classId;
                const feedback = req.body.feedback;
                await classCollection.updateOne(
                    { _id: new ObjectId(classId), status: "pending" },
                    { $set: { status: "denied", feedback: feedback } }
                );
                res.sendStatus(200);
            } catch (error) {
                console.error(error);
                res.status(500).send("Internal Server Error");
            }
        });


        app.patch('/classes', async (req, res) => {
            const id = req.query.id;
            const status = req.query.status;
            let updatedDoc = {};
            if (status === 'approved') {
                updatedDoc = {
                    $set: {
                        status: 'approved'
                    }
                }
            }
            else if (status === 'denied') {
                updatedDoc = {
                    $set: {
                        status: 'denied'
                    }
                }
            }
            const filter = { _id: new ObjectId(id) };
            const result = await classCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        // selected classes ...........st 

        app.get('/selected', verifyJwt, async (req, res) => {
            const email = req.query.email;
            if (!email) {
                res.send([])
            }
            // jwt.........
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'forbidden Access' })
            }
            // jwt.........
            const query = { email: email };
            const result = await selectClassCollection.find(query).toArray();
            res.send(result);
        })

        app.post('/selectedClass', async (req, res) => {
            const classes = req.body;
            const result = await selectClassCollection.insertOne(classes);
            res.send(result);
        })


        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('dance is start')
})

app.listen(port, () => {
    console.log(`boss is running on port ${port}`);
})