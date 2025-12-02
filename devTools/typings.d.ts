/*
 * Game Type Definitions
 */

declare var V: any;  // State.variables
declare var T: any;  // State.temporary

// Player Type
declare interface Player {
    name: string;
    hp: number;
    maxHp: number;
    level: number;
    exp: number;
    stamina?: number;
    maxStamina?: number;
}

// Item Type
declare interface Item {
    name: string;
    description: string;
    value: number;
    consumable: boolean;
}

// Global Functions
declare function createHPBar(current: number, max: number): string;
declare function createExpBar(current: number, required: number): string;
declare function showNotification(message: string, type?: string, duration?: number): void;
declare function autoSave(): void;
declare function quickSave(slotNum?: number): void;
declare function quickLoad(slotNum?: number): void;

// Game Constants
declare namespace GAME_CONSTANTS {
    export let MAX_LEVEL: number;
    export let EXP_BASE: number;
    export let SAVE_KEY: string;
}