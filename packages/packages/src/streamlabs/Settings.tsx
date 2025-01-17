import { z } from "zod";
import { createForm, zodForm } from "@modular-forms/solid";
import { Match, Switch, createSignal, Suspense, Show } from "solid-js";
import { None, Some } from "@macrograph/typesystem";
import { Button, Input } from "@macrograph/ui";

import { Ctx } from "./ctx";

const Schema = z.object({
  socketToken: z.string(),
});

export default (ctx: Ctx) => {
  const { auth } = ctx;

  return (
    <div class="flex flex-col items-start space-y-2">
      <span class="text-neutral-400 font-medium">Socket API</span>
      <Switch fallback="Loading...">
        <Match when={auth.state().type === "disconnected"}>
          {(_) => {
            const [, { Form, Field }] = createForm({
              validate: zodForm(Schema),
            });

            return (
              <Form
                onSubmit={(d) => {
                  auth.setToken(Some(d.socketToken));
                }}
                class="flex flex-row space-x-4"
              >
                <Field name="socketToken">
                  {(field, props) => (
                    <Input
                      {...props}
                      type="password"
                      placeholder="Socket API Key"
                      value={field.value}
                    />
                  )}
                </Field>
                <Button type="submit">Submit</Button>
              </Form>
            );
          }}
        </Match>
        <Match when={auth.state().type === "connected"}>
          <div class="flex flex-row items-center space-x-4">
            <Button onClick={() => auth.setToken(None)}>Disconnect</Button>
          </div>
        </Match>
      </Switch>

      <span class="text-neutral-400 font-medium">OAuth</span>
      <Show when={auth.userToken().isSome()} fallback={<LogIn {...ctx} />}>
        <Suspense fallback="Authenticating...">
          <div class="flex flex-row items-center gap-2">
            <p>Logged in as {auth.user()?.streamlabs.display_name}</p>
            <Button onClick={() => auth.setUserToken(None)}>Log Out</Button>
          </div>
        </Suspense>
      </Show>
    </div>
  );
};

const LogIn = ({ core, auth: { setUserToken } }: Ctx) => {
  const [loggingIn, setLoggingIn] = createSignal(false);

  return (
    <Show
      when={!loggingIn()}
      fallback={
        <div class="flex space-x-4 items-center">
          <p>Logging in...</p>
          <Button onClick={() => setLoggingIn(false)}>Cancel</Button>
        </div>
      }
    >
      <Button
        onClick={async () => {
          setLoggingIn(true);

          try {
            const token = await core.oauth.authorize("streamlabs");

            if (!loggingIn()) return;

            setUserToken(Some(token));
          } finally {
            setLoggingIn(false);
          }
        }}
      >
        Login
      </Button>
      <p class="text-gray-400 text-sm mt-2">
        Login may not work without approval of project maintainer
      </p>
    </Show>
  );
};
