import type { BoundFunctions, queries } from "@testing-library/dom";
import type { UserEvent } from "@testing-library/user-event";
import type { ComponentProps, ComponentType, ReactNode } from "react";

/**
 * Project environment axes. Consumers augment this from `.sunaba/env.d.ts`:
 *
 *   declare module "sunaba/react" {
 *     interface SunabaEnv {
 *       theme: "light" | "dark";
 *     }
 *   }
 */
// oxlint-disable-next-line typescript/consistent-type-definitions -- module augmentation requires an interface
export interface SunabaEnv {}

export type Args = Record<string, unknown>;

// oxlint-disable-next-line typescript/no-explicit-any -- matches React's own "any component" constraint
export type AnyComponent = ComponentType<any>;

export type Layout = "padded" | "centered" | "fullscreen";

export type Determinism = {
  /** Fixed clock origin (ISO 8601 or Date). Defaults to the project setting. */
  date?: string | Date;
  /** PRNG seed. Same seed, same sequence. @default 1 */
  seed?: number;
  /** Replace Math.random. @default true */
  random?: boolean;
  /** Determinize crypto.randomUUID / getRandomValues. @default true */
  crypto?: boolean;
  /** Freeze CSS animations/transitions/caret during capture. @default true */
  animations?: boolean;
  /** Set to false to disable all determinism for this story. */
  enabled?: boolean;
};

/** Reserved for layer 2 (test integration). Catalog-visible from layer 1. */
export type A11yConfig = {
  enabled?: boolean;
  rules?: Record<string, boolean>;
};

/** Reserved for layer 2 (VRT integration). */
export type VrtConfig = { skip?: boolean };

export type StoryContext<TArgs = Args> = {
  /** Canonical story id (`<file>:<Export>`). */
  id: string;
  /** Display name (export name unless overridden by `name`). */
  name: string;
  title: string;
  args: TArgs;
  /** Resolved environment axis values. */
  env: Readonly<Partial<SunabaEnv>>;
  /** Aborted when the story is switched or remounted. */
  abortSignal: AbortSignal;
};

export type Decorator<TArgs = Args> = (
  Story: ComponentType,
  context: StoryContext<TArgs>,
) => ReactNode;

/** Returned cleanup runs on unmount, in reverse registration order. */
export type BeforeEach<TArgs = Args> = (
  context: StoryContext<TArgs>,
) => void | VoidFunction | Promise<void | VoidFunction>;

export type ArgTypes<TArgs> = {
  [K in keyof TArgs]?: {
    description?: string;
    control?: "text" | "number" | "boolean" | "select" | "radio" | "date" | "color" | false;
    options?: readonly unknown[];
    /** Named values reachable from patches/URLs for non-serializable args. */
    mapping?: Record<string, unknown>;
  };
};

export type Canvas = BoundFunctions<typeof queries>;

export type PlayContext<TArgs = Args> = StoryContext<TArgs> & {
  canvasElement: HTMLElement;
  /** Testing-library queries bound to the story root. */
  canvas: Canvas;
  /** A ready `@testing-library/user-event` instance. */
  userEvent: UserEvent;
  step: (label: string, body: () => Promise<void> | void) => Promise<void>;
};

export type Meta<TCmp extends AnyComponent = ComponentType> = {
  title?: string;
  /** Source for props schema extraction. Must be a directly imported identifier. */
  component?: TCmp;
  args?: Partial<ComponentProps<TCmp>>;
  argTypes?: ArgTypes<ComponentProps<TCmp>>;
  decorators?: Decorator<ComponentProps<TCmp>>[];
  beforeEach?: BeforeEach<ComponentProps<TCmp>> | BeforeEach<ComponentProps<TCmp>>[];
  /** Free labels. The `!` prefix is reserved for layer-2 exclusion vocabulary. */
  tags?: string[];
  layout?: Layout;
  /** Pin environment axes for every story in this file. */
  env?: Partial<SunabaEnv>;
  determinism?: Determinism | boolean;
  a11y?: A11yConfig;
  vrt?: VrtConfig;
};

export type StoryDef<TArgs = Args> = {
  name?: string;
  args?: Partial<TArgs>;
  argTypes?: ArgTypes<TArgs>;
  render?: (args: TArgs, context: StoryContext<TArgs>) => ReactNode;
  play?: (context: PlayContext<TArgs>) => Promise<void> | void;
  decorators?: Decorator<TArgs>[];
  beforeEach?: BeforeEach<TArgs> | BeforeEach<TArgs>[];
  tags?: string[];
  layout?: Layout;
  env?: Partial<SunabaEnv>;
  determinism?: Determinism | boolean;
  a11y?: A11yConfig;
  vrt?: VrtConfig;
};

/** Accepts both `StoryObj<typeof meta>` and `StoryObj<typeof Component>`. */
export type StoryObj<T = ComponentType> = [T] extends [AnyComponent]
  ? StoryDef<ComponentProps<T>>
  : T extends { component?: infer C }
    ? C extends AnyComponent
      ? StoryDef<ComponentProps<C>>
      : StoryDef<Args>
    : StoryDef<Args>;

export type PreviewConfig = {
  /** Runs once per stage page, before the first render. */
  setup?: () => void | Promise<void>;
  /**
   * Document-level axis effects applied before React renders (paint
   * consistency for capture), e.g. toggling a class on <html>.
   */
  applyEnv?: { [K in keyof SunabaEnv]?: (value: SunabaEnv[K]) => void };
  decorators?: Decorator[];
  beforeEach?: BeforeEach | BeforeEach[];
};

export const definePreview = (config: PreviewConfig): PreviewConfig => config;
