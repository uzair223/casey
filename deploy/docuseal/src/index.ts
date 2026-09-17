import { Container, getContainer } from "@cloudflare/containers";

export type DocusealEnv = {
  DOCUSEAL: DurableObjectNamespace<DocusealContainer>;
  DOCUSEAL_SECRET_KEY_BASE: string;
};

export class DocusealContainer extends Container<DocusealEnv> {
  defaultPort = 3000;
  requiredPorts = [3000];
  sleepAfter = "24h";
  enableInternet = true;
}

export default {
  async fetch(request: Request, env: DocusealEnv) {
    const container = getContainer(env.DOCUSEAL);
    const host = new URL(request.url).host;
    await container.startAndWaitForPorts({
      ports: [3000],
      startOptions: {
        envVars: {
          HOST: host,
          FORCE_SSL: "true",
          SECRET_KEY_BASE: env.DOCUSEAL_SECRET_KEY_BASE,
        },
      },
      cancellationOptions: {
        instanceGetTimeoutMS: 120_000,
        portReadyTimeoutMS: 180_000,
      },
    });
    return container.fetch(request);
  },
};
