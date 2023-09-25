import { test, expect, describe } from "vitest";
import {
  MapValue,
  None,
  Some,
  createEnum,
  createStruct,
  t,
} from "@macrograph/core";

import { toJSON, JSON, jsonToJS, jsToJSON } from "./json";

describe("toJSON", () => {
  test("t.Option (None) -> Null", () => {
    expect(toJSON(t.option(t.int()), None)).toEqual(JSON.variant("Null"));
  });
  test("t.Option<t.Int> (Some) -> Number", () => {
    expect(toJSON(t.option(t.int()), Some(5))).toEqual(
      JSON.variant(["Number", { value: 5 }])
    );
  });
  test("t.Int  -> Number", () => {
    expect(toJSON(t.int(), 0)).toEqual(JSON.variant(["Number", { value: 0 }]));
  });
  test("t.Float -> Number", () => {
    expect(toJSON(t.int(), 0)).toEqual(JSON.variant(["Number", { value: 0 }]));
  });
  test("t.String -> String", () => {
    expect(toJSON(t.string(), "")).toEqual(
      JSON.variant(["String", { value: "" }])
    );
  });
  test("t.Bool -> Bool", () => {
    expect(toJSON(t.bool(), false)).toEqual(
      JSON.variant(["Bool", { value: false }])
    );
  });
  test("t.List<t.Bool> -> List<bool>", () => {
    expect(toJSON(t.list(t.bool()), [])).toEqual(
      JSON.variant(["List", { value: [] }])
    );
  });
  test("t.Map<t.Bool> -> Map<Bool>", () => {
    const value = new Map();
    expect(toJSON(t.map(t.bool()), value)).toEqual(
      JSON.variant(["Map", { value: value as never }])
    );
  });
  test("t.Enum<JSON> -> JSON", () => {
    const value = JSON.variant(["String", { value: "" }]);
    expect(toJSON(t.enum(JSON), value)).toEqual(value);
  });
  test("t.Enum<TestEnum> -> Map<JSONValue>", () => {
    const TestEnum = createEnum("TestEnum", (e) => [
      e.variant("Unit"),
      e.variant("Named", {
        value: t.string(),
      }),
    ]);

    expect(toJSON(t.enum(TestEnum), TestEnum.variant("Unit"))).toEqual(
      JSON.variant([
        "Map",
        {
          value: new Map(
            Object.entries({
              variant: JSON.variant(["String", { value: "Unit" }]),
            })
          ),
        },
      ])
    );

    expect(
      toJSON(t.enum(TestEnum), TestEnum.variant(["Named", { value: "" }]))
    ).toEqual(
      JSON.variant([
        "Map",
        {
          value: new Map(
            Object.entries({
              variant: JSON.variant(["String", { value: "Named" }]),
              data: JSON.variant([
                "Map",
                {
                  value: new Map(
                    Object.entries({
                      value: JSON.variant(["String", { value: "" }]),
                    })
                  ),
                },
              ]),
            })
          ),
        },
      ])
    );
  });
  test("t.Struct<TestStruct> -> Map<JSONValue>", () => {
    const TestStruct = createStruct("TestStruct", (s) => ({
      string: s.field("String", t.string()),
      int: s.field("Int", t.int()),
      bool: s.field("Bool", t.bool()),
      json: s.field("JSON", t.enum(JSON)),
    }));

    const value = {
      string: "",
      int: 0,
      bool: true,
      json: JSON.variant("Null"),
    };

    expect(toJSON(t.struct(TestStruct), value)).toEqual(
      JSON.variant([
        "Map",
        {
          value: new Map(
            Object.entries({
              string: JSON.variant(["String", { value: value.string }]),
              int: JSON.variant(["Number", { value: value.int }]),
              bool: JSON.variant(["Bool", { value: value.bool }]),
              json: value.json,
            })
          ) as any,
        },
      ])
    );
  });
});

describe("jsonToJS", () => {
  test("Null -> null", () => {
    expect(jsonToJS(JSON.variant("Null"))).toBeNull();
  });
  test("Number -> number", () => {
    const value = 4;
    expect(jsonToJS(JSON.variant(["Number", { value }]))).toEqual(value);
  });
  test("String -> string", () => {
    const value = "string";
    expect(jsonToJS(JSON.variant(["String", { value }]))).toEqual(value);
  });
  test("Bool -> boolean", () => {
    const value = true;
    expect(jsonToJS(JSON.variant(["Bool", { value }]))).toEqual(value);
  });
  test("List -> Array<T>", () => {
    const value: never[] = [];
    expect(jsonToJS(JSON.variant(["List", { value }]))).toEqual(value);
  });
  test("Map -> MapValue<T>", () => {
    expect(
      jsonToJS(JSON.variant(["Map", { value: new Map() as MapValue<never> }]))
    ).toEqual({});
    const value = {
      number: 4,
      string: "string",
    };
    expect(
      jsonToJS(
        JSON.variant([
          "Map",
          {
            value: new Map(
              Object.entries({
                number: JSON.variant(["Number", { value: value.number }]),
                string: JSON.variant(["String", { value: value.string }]),
              })
            ) as MapValue<never>,
          },
        ])
      )
    ).toEqual(value);
  });
});

describe("jsToJSON", () => {
  test("null -> Null", () => {
    expect(jsToJSON(null)).toEqual(JSON.variant("Null"));
  });
  test("number -> Number", () => {
    const value = 4;
    expect(jsToJSON(value)).toEqual(JSON.variant(["Number", { value }]));
  });
  test("string -> String", () => {
    const value = "value";
    expect(jsToJSON(value)).toEqual(JSON.variant(["String", { value }]));
  });
  test("boolean -> Bool", () => {
    const value = true;
    expect(jsToJSON(value)).toEqual(JSON.variant(["Bool", { value }]));
  });
  test("Array<T> -> List", () => {
    expect(jsToJSON([])).toEqual(JSON.variant(["List", { value: [] }]));
  });
  test("object -> Object", () => {
    expect(jsToJSON({})).toEqual(
      JSON.variant(["Map", { value: new Map<string, never>() }])
    );
    const value = {
      number: 4,
      string: "string",
      object: {
        nested: true,
      },
    };
    expect(jsToJSON(value)).toEqual(
      JSON.variant([
        "Map",
        {
          value: new Map([
            [
              "number",
              JSON.variant(["Number", { value: value.number }]) as never,
            ],
            [
              "string",
              JSON.variant(["String", { value: value.string }]) as never,
            ],
            [
              "object",
              JSON.variant([
                "Map",
                {
                  value: new Map([
                    [
                      "nested",
                      JSON.variant([
                        "Bool",
                        { value: value.object.nested },
                      ]) as never,
                    ],
                  ]),
                },
              ]) as never,
            ],
          ]),
        },
      ])
    );
  });
});
