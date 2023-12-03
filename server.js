const express = require('express');
const app = express();
const path = require('path');
const server = require('http').Server(app);
const io = require('socket.io')(server);

// Firebase setup
const admin = require('firebase-admin');
const serviceAccount = require('./webappcode-af3e9-firebase-adminsdk-qedds-45f7353d49.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://your-firebase-project-id.firebaseio.com',
});

const db = admin.firestore();
const codeBlocksCollection = db.collection('codeBlocks');

const port = process.env.PORT || 8080;

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'src/lobby.html'));
});

app.use(express.static(path.join(__dirname, 'src')));

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });

    socket.on('joinCodeBlock', async ({ codeBlockId }) => {
        socket.join(codeBlockId);

        try {
            // Retrieve the code block data from Firestore using the document ID (codeBlockId)
            const codeBlockDoc = await codeBlocksCollection.doc(codeBlockId).get();

            if (!codeBlockDoc.exists) {
                console.error(`Code block with document ID ${codeBlockId} not found.`);
                return;
            }

            const code = codeBlockDoc.data()?.code || '';

            io.to(socket.id).emit('codeChange', code);

            // Check if the client is the mentor
            const clientsInRoom = io.sockets.adapter.rooms.get(codeBlockId);
            if (!clientsInRoom || clientsInRoom.size === 1) {
                io.to(socket.id).emit('allowEdit', false);
            } else {
                io.to(socket.id).emit('allowEdit', true);
            }
        } catch (error) {
            console.error('Error fetching code block from Firestore:', error);
        }
    });

    socket.on('editCode', async ({ codeBlockId, newCode }) => {
        await codeBlocksCollection.doc(codeBlockId).update({ code: newCode });
        io.to(codeBlockId).emit('codeChange', newCode);
    });
});

app.get('/codeblock', (req, res) => {
    const blockNumber = req.query.block;
    res.sendFile(path.join(__dirname, 'src/codeblock.html'));
});

server.listen(port, () => {
    console.log(`App listening on port ${port}`);
});
