export class AssetManager {
  assets: any[];
}

export class UnityFS {
  constructor(buffer: Uint8Array, options?: LoadOptions);
  parse(): void;
  assetManager: AssetManager;
}

export interface LoadOptions {
  unityRevision?: string;
  sliceBeforeSecondUnityFS?: boolean;
  [key: string]: any;
}

export function load(
  source: string | ArrayBuffer | Uint8Array,
  options?: LoadOptions
): Promise<AssetManager>;

export function registerClass(
  classId: number,
  className: string,
  parserClass: any
): void;

export function setDependencies(deps: Record<string, any>): void;
