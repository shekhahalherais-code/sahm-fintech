import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { mockupPreviewPlugin } from "./mockupPreviewPlugin.ts";

test("preview discovery includes nested TSX files and excludes private helpers", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "mockup-discovery-"));
  const mockups = path.join(root, "src/components/mockups");
  const generated = path.join(root, "src/.generated/mockup-components.ts");
  const create = async (file) => {
    const target = path.join(mockups, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, "export default function Preview() { return null; }\n");
  };

  try {
    for (const file of [
      "Home.tsx",
      "nested/Review.tsx",
      "_Helper.tsx",
      "_internal/Hidden.tsx",
      "nested/_Helper.tsx",
      ".hidden.tsx",
      "NotAComponent.ts",
    ]) {
      await create(file);
    }

    const plugin = mockupPreviewPlugin();
    plugin.configResolved({ root });
    await plugin.buildStart();
    let source = await readFile(generated, "utf8");
    assert.match(source, /\.\/components\/mockups\/Home\.tsx/);
    assert.match(source, /\.\/components\/mockups\/nested\/Review\.tsx/);
    assert.doesNotMatch(source, /Helper|Hidden|hidden|NotAComponent/);
    assert.equal((source.match(/=> import\(/g) ?? []).length, 2);

    await create("Added.tsx");
    await rm(path.join(mockups, "Home.tsx"));
    await plugin.buildStart();
    source = await readFile(generated, "utf8");
    assert.match(source, /Added\.tsx/);
    assert.doesNotMatch(source, /Home\.tsx/);

    await rm(mockups, { recursive: true });
    await plugin.buildStart();
    source = await readFile(generated, "utf8");
    assert.doesNotMatch(source, /=> import\(/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
