import { WebSocket } from "https://deno.land/x/websocket/mod.ts";

export interface GameProgressResponse {
    attacks1: number[];
    attacks2: number[];
}

export interface MessageResponse {
    message: string;
}

export interface RoomResponse {
    roomId: string;
}

export enum ResponseType {
    GameProgress = 'GAME_PROGRESS',
    Message = 'MESSAGE',
    Room = 'ROOM',
    OtherJoin = 'OTHER_JOIN',
    JoinSuccess = 'JOIN_SUCCESS',
}

export type PlayerInfo = {
    name: string;
    ws: WebSocket;
    blood: number;
}

export type RoomInfo = {
    player1: PlayerInfo;
    player2: PlayerInfo | null;
}
