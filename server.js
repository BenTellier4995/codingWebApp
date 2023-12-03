// Necessary modules
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

// Serve lobby.html when the root URL is accessed
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'src/lobby.html'));
});

// Serve static files from the 'src' directory
app.use(express.static(path.join(__dirname, 'src')));

// Handle socket.io connections
io.on('connection', (socket) => {
    console.log('A user connected');

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });

    // Handle joining a code block room
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

            // Send the current code to the connected client
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
    // Handle code editing
    socket.on('editCode', async ({ codeBlockId, newCode }) => {
        await codeBlocksCollection.doc(codeBlockId).update({ code: newCode });
        io.to(codeBlockId).emit('codeChange', newCode);
    });
});

// Serve codeblock.html for specific code blocks
app.get('/codeblock', (req, res) => {
    const blockNumber = req.query.block;
    res.sendFile(path.join(__dirname, 'src/codeblock.html'));
});

// Start the server and listen on the specified port
server.listen(port, () => {
    console.log(`App listening on port ${port}`);
});
