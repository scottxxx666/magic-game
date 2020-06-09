import { WebSocket, WebSocketServer } from "https://deno.land/x/websocket/mod.ts";
import rand from 'https://deno.land/x/rand/mod.ts';

const wss = new WebSocketServer(8080);

const map = new Map<string, WebSocket>();

function success(ws: WebSocket, data?: { roomId: string } | { message: string }) {
    return send(ws, true, data, undefined)
}

function fail(ws: WebSocket, error: { reason: string }) {
    return send(ws, false, undefined, error)
}

function send(ws: WebSocket, success: boolean = true, data: { roomId: string } | { message: string } | undefined, error: { reason: string } | undefined) {
    ws.send(JSON.stringify({ success, data, error }));
}

function createRoom(ws: WebSocket) {
    const roomId = rand.u13().toString().padStart(4, '0');
    map.set(roomId, ws);
    success(ws, { roomId })
}

function join(ws: WebSocket, message: string) {
    const { data: { roomId, name } } = JSON.parse(message);
    const socket = map.get(roomId);
    if (!socket) {
        fail(ws, { reason: '查無此房！' })
        return;
    }
    success(socket, { message: `${name} JOIN!` })
    success(ws)
}

const router: { [key: string]: (ws: WebSocket, message: string) => void } = {
    'NEW': createRoom,
    'JOIN': join,
}

wss.on("connection", function (ws: WebSocket) {
    ws.on("message", function (message: string) {
        console.log(message);
        const { action, data } = JSON.parse(message);
        if (!router.hasOwnProperty(action)) {
            console.error('Route not found.');
            fail(ws, { reason: 'Route not found.' });
            return;
        }
        router[action](ws, message);
    });

    ws.on("close", function (code: number) {
        console.log('close', code);
    })
});

wss.on("error", (e: any) => {
    console.error('err', e);
})

