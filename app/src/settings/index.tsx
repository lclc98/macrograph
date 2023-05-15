import { Dialog } from "@kobalte/core";
import { ParentProps } from "solid-js";
import Discord from "./Discord";
import OBS from "./OBS";
import Twitch from "./Twitch";
import { Button } from "./ui";

export default () => {
  return (
    <Dialog.Root>
      <Dialog.Trigger as="div">
        <Button>Open Settings</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay class="absolute inset-0 bg-black/40" />
        <Dialog.Content class="absolute inset-0 flex flex-col justify-center items-center py-10">
          <div class="flex flex-col w-full max-w-2xl bg-neutral-800 p-4 text-white rounded-lg space-y-4">
            <div class="flex flex-row justify-between">
              <Dialog.Title>Settings</Dialog.Title>
              <Dialog.CloseButton>X</Dialog.CloseButton>
            </div>
            <div class="flex-1 flex flex-col space-y-4">
              <Section title="Twitch">
                <Twitch />
              </Section>
              <Section title="Discord">
                <Discord />
              </Section>
              <Section title="OBS">
                <OBS />
              </Section>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

const Section = (props: { title: string } & ParentProps) => {
  return (
    <section class="bg-neutral-900 rounded-md divide-y divide-neutral-600 border border-neutral-600">
      <h3 class="p-3 font-medium text-xl">{props.title}</h3>
      <div class="p-4">{props.children}</div>
    </section>
  );
};