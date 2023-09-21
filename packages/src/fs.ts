import { Package, t } from "@macrograph/core";

type Entry = { Dir: string } | { File: string };

export function register(actions: { list(path: string): Promise<Entry[]> }) {
  const pkg = new Package({ name: "FS" });

  pkg.createNonEventSchema({
    name: "List Files",
    variant: "Exec",
    generateIO(io) {
      return {
        path: io.dataInput({
          id: "path",
          name: "Folder Path",
          type: t.string(),
        }),
        files: io.dataOutput({
          id: "files",
          name: "Files",
          type: t.list(t.string()),
        }),
      };
    },
    async run({ ctx, io }) {
      const files = await actions.list(ctx.getInput(io.path));

      const array = files
        .map((f) => {
          if ("File" in f) return f.File;
        })
        .filter(Boolean) as string[];

      ctx.setOutput(io.files, array);
    },
  });

  return pkg;
}