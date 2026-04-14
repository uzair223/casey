declare module "canvas-confetti" {
  export type Options = {
    particleCount?: number;
    angle?: number;
    spread?: number;
    startVelocity?: number;
    decay?: number;
    gravity?: number;
    drift?: number;
    scalar?: number;
    ticks?: number;
    zIndex?: number;
    colors?: string[];
    origin?: {
      x?: number;
      y?: number;
    };
  };

  export interface CreateTypes {
    (options?: Options): Promise<null> | null;
  }

  const confetti: CreateTypes;
  export default confetti;
}
