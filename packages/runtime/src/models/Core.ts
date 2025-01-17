import { createMutable } from "solid-js/store";
import { z } from "zod";
import { Option } from "@macrograph/typesystem";

import { Package } from "./Package";
import { Node } from "./Node";
import { DataInput, DataOutput, ScopeOutput } from "./IO";
import { EventsMap, RunCtx } from "./NodeSchema";
import { Project } from "./Project";
import { SerializedProject } from "./serialized";

class NodeEmit {
  listeners = new Map<Node, Set<(d: Node) => any>>();

  emit(node: Node) {
    this.listeners.get(node)?.forEach((l) => l(node));
  }

  subscribe(node: Node, cb: (d: Node) => any) {
    if (!this.listeners.has(node)) this.listeners.set(node, new Set());
    const listeners = this.listeners.get(node)!;

    listeners?.add(cb);

    return () => {
      listeners?.delete(cb);
      if (listeners?.size === 0) this.listeners.delete(node);
    };
  }
}

export const NODE_EMIT = new NodeEmit();

export type OAuthToken = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string[];
  issued_at: number;
};

export type RefreshedOAuthToken = Omit<OAuthToken, "refresh_token">;

type OAuth = {
  authorize(provider: string): Promise<OAuthToken>;
  refresh(
    provider: string,
    refreshToken: string
  ): Promise<OAuthToken | RefreshedOAuthToken>;
};

export class Core {
  project: Project = new Project({
    core: this,
  });

  packages = [] as Package<any, any>[];

  eventNodeMappings = new Map<Package, Map<string, Set<Node>>>();

  fetch: typeof fetch;
  oauth: OAuth;

  constructor(args: { fetch: typeof fetch; oauth: OAuth }) {
    this.fetch = args.fetch;
    this.oauth = args.oauth;

    return createMutable(this);
  }

  async load(projectData: z.infer<typeof SerializedProject>) {
    this.eventNodeMappings.clear();
    this.project = await Project.deserialize(this, projectData);
  }

  schema(pkg: string, name: string) {
    return this.packages.find((p) => p.name === pkg)?.schema(name);
  }

  registerPackage(packageFactory: (core: this) => Package<any>) {
    const pkg = packageFactory(this);
    pkg.core = this;
    this.packages.push(pkg);
  }

  emitEvent<TEvents extends EventsMap, TEvent extends keyof EventsMap>(
    pkg: Package<TEvents, any>,
    event: { name: TEvent; data: TEvents[TEvent] }
  ) {
    const mappings = this.eventNodeMappings
      .get(pkg as any)
      ?.get(event.name as string);

    mappings?.forEach((n) => new ExecutionContext(n).run(event.data));
  }

  private printListeners = new Set<(msg: string) => void>();

  print(msg: string) {
    for (const cb of this.printListeners) {
      cb(msg);
    }
  }

  printSubscribe(cb: (msg: string) => void) {
    this.printListeners.add(cb);
    return () => this.printListeners.delete(cb);
  }
}

export class ExecutionContext {
  data = new Map<DataOutput<any> | ScopeOutput, any>();

  constructor(public root: Node) {}

  run(data: any) {
    NODE_EMIT.emit(this.root);

    this.root.schema.run({
      ctx: this.createCtx(this.root),
      io: this.root.ioReturn,
      data,
      properties: this.root.schema.properties ?? {},
      graph: this.root.graph,
    });
  }

  createCtx(node: Node): RunCtx {
    return {
      exec: async (execOutput) => {
        await execOutput
          .connection()
          .peekAsync((conn) => this.execNode(conn.node));
      },
      execScope: async (scopeOutput, data) => {
        await scopeOutput.connection().peekAsync(async (conn) => {
          this.data.set(scopeOutput, data);

          await this.execNode(conn.node);
        });
      },
      setOutput: (output, value) => {
        this.data.set(output, value);
      },
      getInput: (input) => {
        return (
          input.connection as Option<DataOutput<any> | ScopeOutput>
        ).mapOrElse(
          () => {
            if (input instanceof DataInput)
              return input.defaultValue ?? input.type.default();
          },
          (conn) => {
            const data = this.data.get(conn);

            if (data === undefined)
              throw new Error(`Data not found for input '${input.name}'!`);

            return data;
          }
        );
      },
      getProperty: (p) => node.getProperty(p) as any,
    };
  }

  async execNode(node: Node) {
    if (
      "event" in node.schema ||
      ("type" in node.schema && node.schema.type === "event")
    )
      throw new Error("Cannot exec an Event node!");

    NODE_EMIT.emit(node);

    // calculate previous outputs
    node.state.inputs.forEach((i) => {
      if (!(i instanceof DataInput)) return;

      i.connection.peek((conn) => {
        const connectedNode = conn.node;
        const schema = connectedNode.schema;

        if ("variant" in schema && schema.variant === "Pure") {
          // Pure nodes recalculate each time

          this.execNode(connectedNode as any);
        } else {
          // Value should already be present for non-pure nodes

          let value = this.data.get(conn);

          if (value === undefined)
            throw new Error(
              `Data for Pin ${conn.name}, Node ${conn.node.state.name} not found!`
            );
        }
      });
    });

    await node.schema.run({
      ctx: this.createCtx(node),
      io: node.ioReturn,
      properties: node.schema.properties ?? {},
      graph: node.graph,
    });
  }
}
