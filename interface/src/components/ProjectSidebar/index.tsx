import { For, Match, Show, Switch, createMemo, createSignal } from "solid-js";
import { Graph } from "@macrograph/runtime";
import { Card } from "@macrograph/ui";
import { DropdownMenu } from "@kobalte/core";

import { useCore, useCoreContext } from "../../contexts";
import { GraphItem } from "./GraphItem";
import { SidebarSection } from "../Sidebar";
import { deserializeClipboardItem, readFromClipboard } from "../../clipboard";
import { SelectInput } from "../ui";

export function Resources() {
  const core = useCore();

  const resources = createMemo(() => [...core.project.resources]);

  return (
    <SidebarSection title="Resources" right={<AddResourceButton />}>
      <ul class="p-2">
        <For each={resources()}>
          {([type, data]) => {
            const [open, setOpen] = createSignal(true);

            return (
              <Card as="li" class="divide-y divide-black">
                <div class="p-2 space-y-1">
                  <button onClick={() => setOpen((o) => !o)}>
                    <div class="flex flex-row items-center gap-2">
                      <IconFa6SolidChevronRight
                        class="w-3 h-3"
                        classList={{ "rotate-90": open() }}
                      />
                      <span class="font-medium">{type.name}</span>
                    </div>
                  </button>
                  <Show when={open()}>
                    <div class="flex flex-row items-center gap-2">
                      Default
                      <div class="flex-1">
                        <SelectInput
                          options={data.items}
                          optionValue="id"
                          optionTextValue="name"
                          getLabel={(i) => i.name}
                          onChange={(source) => (data.default = source.id)}
                          value={data.items.find((s) => s.id === data.default)}
                        />
                      </div>
                    </div>
                  </Show>
                </div>
                <Show when={open()}>
                  <ul class="space-y-2">
                    <For each={data.items}>
                      {(item, index) => {
                        const [editingName, setEditingName] =
                          createSignal(false);

                        return (
                          <li class="space-y-1 p-2">
                            <div class="space-y-1 flex flex-row gap-2 justify-between items-center">
                              <Switch>
                                <Match when={editingName()}>
                                  {(_) => {
                                    const [value, setValue] = createSignal(
                                      item.name
                                    );

                                    return (
                                      <>
                                        <input
                                          class="flex-1 text-black"
                                          value={value()}
                                          onChange={(e) =>
                                            setValue(e.target.value)
                                          }
                                        />
                                        <div class="flex flex-row">
                                          <button
                                            onClick={() => {
                                              item.name = value();
                                              setEditingName(false);
                                              core.project.save();
                                            }}
                                          >
                                            <IconAntDesignCheckOutlined class="w-5 h-5" />
                                          </button>
                                          <button
                                            onClick={() =>
                                              setEditingName(false)
                                            }
                                          >
                                            <IconBiX class="w-6 h-6" />
                                          </button>
                                        </div>
                                      </>
                                    );
                                  }}
                                </Match>
                                <Match when={!editingName()}>
                                  <span class="shrink-0">{item.name}</span>
                                  <div class="gap-2 flex flex-row">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();

                                        setEditingName(true);
                                      }}
                                    >
                                      <IconAntDesignEditOutlined />
                                    </button>

                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();

                                        data.items.splice(index(), 1);
                                        if (data.items.length < 1)
                                          core.project.resources.delete(type);

                                        core.project.save();
                                      }}
                                    >
                                      <IconAntDesignDeleteOutlined />
                                    </button>
                                  </div>
                                </Match>
                              </Switch>
                            </div>
                            <SelectInput
                              options={type.sources()}
                              optionValue="id"
                              optionTextValue="display"
                              getLabel={(i) => i.display}
                              onChange={(source) => (item.sourceId = source.id)}
                              value={type
                                .sources()
                                .find((s) => s.id === item.sourceId)}
                            />
                          </li>
                        );
                      }}
                    </For>
                  </ul>
                </Show>
              </Card>
            );
          }}
        </For>
      </ul>
    </SidebarSection>
  );
}

function AddResourceButton() {
  const core = useCore();

  const resourceTypes = createMemo(() =>
    core.packages
      .map((p) => {
        if (p.resources.size > 0) return [p, [...p.resources]] as const;
      })
      .filter(Boolean)
  );

  return (
    <DropdownMenu.Root placement="bottom-end">
      <DropdownMenu.Trigger onClick={(e) => e.stopPropagation()}>
        <IconMaterialSymbolsAddRounded class="w-6 h-6" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content class="bg-neutral-900 border border-black p-2 rounded w-52 max-h-48 flex flex-col overflow-y-auto text-white">
          <For each={resourceTypes()}>
            {([pkg, types]) => (
              <>
                <span class="p-1">{pkg.name}</span>
                <For each={types}>
                  {(type) => (
                    <DropdownMenu.Item
                      as="button"
                      class="flex flex-row items-center w-full px-2 py-0.5 text-left hover:bg-white/20 rounded text-sm"
                      onSelect={() => {
                        core.project.createResource({
                          type,
                          name: "New Resource",
                        });
                      }}
                    >
                      {type.name}
                    </DropdownMenu.Item>
                  )}
                </For>
              </>
            )}
          </For>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

// React component to show a list of projects
interface Props {
  currentGraph?: number;
  onGraphClicked(graph: Graph): void;
}

export function GraphList(props: Props) {
  const ctx = useCoreContext();

  return (
    <SidebarSection
      title="Graphs"
      right={
        <div class="flex flex-row items-center text-xl font-bold space-x-1">
          <button
            onClick={async (e) => {
              e.stopPropagation();
              const item = deserializeClipboardItem(await readFromClipboard());
              if (item.type !== "graph") return;

              item.graph.id = ctx.core.project.generateGraphId();
              const graph = Graph.deserialize(ctx.core.project, item.graph);
              ctx.core.project.graphs.set(graph.id, graph);
            }}
          >
            <IconGgImport />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const graph = ctx.core.project.createGraph();
              props.onGraphClicked(graph);
            }}
          >
            <IconMaterialSymbolsAddRounded class="w-6 h-6" />
          </button>
        </div>
      }
    >
      <For each={[...ctx.core.project.graphs.values()]}>
        {(graph) => (
          <GraphItem
            graph={graph}
            onClick={() => props.onGraphClicked(graph)}
            isCurrentGraph={graph.id === props.currentGraph}
          />
        )}
      </For>
    </SidebarSection>
  );
}
