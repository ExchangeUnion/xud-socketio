import * as express from "express";
import * as socketio from "socket.io";
import * as fs from "fs";
import * as grpc from "grpc";
import {XudClient} from './proto/xudrpc_grpc_pb';
import OrderManager from "./OrderManager";

const app = express();
app.set("port", process.env.PORT || 8080);

let http = require("http").Server(app);

let io = socketio(http);

app.use(express.static("public"))

function createXudClient() {
    const cert = fs.readFileSync("tls.cert");
    const credential = grpc.credentials.createSsl(cert);
    return new XudClient("127.0.0.1:28886", credential);
}

const xudClient = createXudClient();
const orderManager = new OrderManager(xudClient, io);
orderManager.start()

app.get("/api/orders/:pair", function (req, res) {
    res.send(JSON.stringify(orderManager.snapshot(req.params.pair)))
})

app.get("/api/pairs", function (req, res) {
    res.send(JSON.stringify(orderManager.pairs))
})

http.listen(8080, () => {
    console.log("listen on 127.0.0.1:8080");
    io.on("connection", (socket) => {
        // TODO add logging framework
        console.log("a user connected");
    });
});
