// See https://kit.svelte.dev/docs/types#app
declare global {
  namespace App {
    interface Locals {
      user?: {
        id: number;
        email: string;
        fullName: string;
        role: string;
        rewardsTier: string;
        quantumPoints: number;
      } | null;
    }
  }
}
export {};
