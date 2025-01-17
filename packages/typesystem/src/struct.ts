import { createMutable } from "solid-js/store";
import { z } from "zod";
import { t, TypeVariant, Wildcard } from ".";
import { BaseType } from "./base";

export class StructField<Type extends t.Any = t.Any> {
  constructor(public name: string, public type: Type) {
    return createMutable(this);
  }

  default(): any {
    return this.type.default();
  }
}

export type StructFields = Record<string, StructField>;

export class LazyStructFields<Fields extends StructFields = StructFields> {
  constructor(public build: () => Fields) {}
}

export class Struct<Fields extends StructFields = StructFields> {
  source?: { package: string } | "project";

  constructor(public name: string, fields: Fields | LazyStructFields<Fields>) {
    if (fields instanceof LazyStructFields) {
      this._fields = {
        type: "lazy",
        fields,
      };
    } else {
      this._fields = {
        type: "resolved",
        fields,
      };
    }
  }

  _fields:
    | { type: "resolved"; fields: Fields }
    | { type: "lazy"; fields: LazyStructFields<Fields> };

  get fields() {
    let val = this._fields;

    if (val.type === "lazy") {
      this._fields = val = {
        type: "resolved",
        fields: val.fields.build(),
      };
    }

    return val.fields;
  }

  create(data: InferStruct<this>): InferStruct<this> {
    return data;
  }

  static refSchema = z.union([
    z.object({ source: z.literal("project"), name: z.string() }),
    z.object({
      source: z.literal("package"),
      package: z.string(),
      name: z.string(),
    }),
  ]);

  getRef(): z.infer<typeof Struct.refSchema> {
    const source = this.source;

    if (!source) throw new Error(`Struct ${this.name} has no source!`);

    if (source === "project") return { source: "project", name: this.name };
    else return { source: "package", package: source.package, name: this.name };
  }
}

export class StructBuilder {
  field<Type extends t.Any>(name: string, type: Type) {
    return new StructField(name, type);
  }

  lazy<T extends StructFields>(fn: () => T) {
    return new LazyStructFields(fn);
  }
}

export class StructType<TStruct extends Struct> extends BaseType<
  InferStruct<TStruct>
> {
  constructor(public struct: TStruct) {
    super();
  }

  default(): InferStruct<TStruct> {
    return Object.entries(this.struct.fields).reduce(
      (acc, [key, value]) => ({
        ...acc,
        [key]: value.default(),
      }),
      {}
    ) as any;
  }

  variant(): TypeVariant {
    return "struct";
  }

  toString(): string {
    return `Struct(${this.struct.name})`;
  }

  // asZodType(): z.ZodType<InferStruct<TStruct>> {
  //   return z.object(
  //     Object.entries(this.struct.fields).reduce(
  //       (acc, [key, value]) => ({
  //         ...acc,
  //         [key]: value.type.asZodType(),
  //       }),
  //       {}
  //     )
  //   ) as any;
  // }

  getWildcards(): Wildcard[] {
    return Object.values(this.struct.fields).flatMap((f) =>
      f.type.getWildcards()
    );
  }

  eq(other: t.Any): boolean {
    return other instanceof t.Struct && other.struct === this.struct;
  }

  serialize() {
    throw new Error("Struct cannot be serialized yet!");
  }

  deserialize() {
    return this;
  }

  hasWildcard(): boolean {
    return false;
  }
}

export type InferStruct<S> = S extends Struct<infer Fields>
  ? InferStructFields<Fields>
  : never;

export type InferStructFields<F> = F extends StructFields
  ? { [K in keyof F]: InferStructField<F[K]> }
  : never;

export type InferStructField<F> = F extends StructField<infer Type>
  ? Type extends BaseType<infer TOut>
    ? TOut
    : never
  : never;
