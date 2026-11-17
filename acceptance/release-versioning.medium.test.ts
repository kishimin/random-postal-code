import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, test } from "bun:test";

/*
 * Acceptance test for Issue #133: version each release after v1.0.0 with
 * release-please, and hand the owner a ready-to-post X link on Discord.
 *
 * Each test name states the acceptance criterion it holds, so a failure names
 * the criterion that broke rather than only the assertion.
 *
 * What this test can and cannot observe
 * -------------------------------------
 * Whether release-please really opens a pull request, whether GitHub creates
 * the tag, whether the Ruleset requires the title check, and whether Discord
 * receives the message are observed on GitHub after merging, not here. The
 * scheduled loop's prompt lives outside the repository. This test holds what
 * the repository controls: the workflows and what they hand to which token,
 * the release-please configuration and the versions it starts from, the
 * changelog, and the two scripts that judge a pull request title and announce
 * a release.
 *
 * The scripts are loaded inside each test: while they do not exist, only the
 * tests about them fail, each saying so.
 */

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const scriptsDirectory = path.join(repositoryRoot, ".github", "scripts");
const workflowsDirectory = path.join(repositoryRoot, ".github", "workflows");
const titleScriptPath = path.join(scriptsDirectory, "check-pr-title.mjs");
const announceScriptPath = path.join(scriptsDirectory, "announce-release.mjs");

const WORKSPACES = [
  "packages/shared",
  "packages/postal-data",
  "apps/web/frontend",
  "apps/web/backend",
] as const;

const SITE = "https://zipnami.pages.dev";
const WEBHOOK = "https://discord.example.test/api/webhooks/1/secret-token";

type Step = {
  id?: string;
  name?: string;
  if?: string;
  run?: string;
  uses?: string;
  env?: Record<string, string>;
  with?: Record<string, string>;
};
type Job = { if?: string; needs?: string | string[]; steps?: Step[] };
type Workflow = { on?: Record<string, unknown>; jobs: Record<string, Job> };

const readText = (relative: string): string =>
  readFileSync(path.join(repositoryRoot, relative), "utf8");

const readJson = <T>(relative: string): T =>
  JSON.parse(readText(relative)) as T;

const readWorkflow = (name: string): Workflow => {
  expect(
    readdirSync(workflowsDirectory),
    `.github/workflows/${name} does not exist`,
  ).toContain(name);
  return Bun.YAML.parse(
    readFileSync(path.join(workflowsDirectory, name), "utf8"),
  ) as Workflow;
};

const allSteps = (workflow: Workflow): { jobId: string; step: Step }[] =>
  Object.entries(workflow.jobs).flatMap(([jobId, job]) =>
    (job.steps ?? []).map((step) => ({ jobId, step })),
  );

const stepUsing = (workflow: Workflow, pattern: RegExp) => {
  const found = allSteps(workflow).find(({ step }) =>
    pattern.test(step.uses ?? ""),
  );
  if (found === undefined) {
    throw new Error(`no step uses ${pattern}`);
  }
  return found;
};

const stepRunning = (workflow: Workflow, pattern: RegExp) => {
  const found = allSteps(workflow).find(({ step }) =>
    pattern.test(step.run ?? ""),
  );
  if (found === undefined) {
    throw new Error(`no step runs ${pattern}`);
  }
  return found;
};

const loadModule = async <T>(modulePath: string): Promise<T> => {
  expect(
    readdirSync(scriptsDirectory),
    `.github/scripts/${path.basename(modulePath)} does not exist`,
  ).toContain(path.basename(modulePath));
  return (await import(pathToFileURL(modulePath).href)) as T;
};

describe("Issue #133: pull request titles are Conventional Commits", () => {
  const TYPES = [
    "feat",
    "fix",
    "perf",
    "refactor",
    "docs",
    "test",
    "build",
    "ci",
    "chore",
    "style",
    "revert",
  ];

  const runTitleCheck = (title: string) =>
    spawnSync(process.execPath, [titleScriptPath], {
      env: { ...process.env, PR_TITLE: title },
      encoding: "utf8",
    });

  test("AC1: a title that is not a Conventional Commit fails the check", async () => {
    await loadModule(titleScriptPath);

    for (const title of [
      "Add the five guide pages", // #129's title: no type at all
      "feature: add a page", // not one of the allowed types
      "fix add a page", // no colon
      "fix: ", // no description
      "Fix: add a page", // types are lower case
      "fix(): add a page", // an empty scope
      "fix!add a page",
    ]) {
      expect(runTitleCheck(title).status, `"${title}" passed`).not.toBe(0);
    }
  });

  test("AC1: a Conventional Commit title passes, with or without a scope and !", async () => {
    await loadModule(titleScriptPath);

    for (const type of TYPES) {
      for (const title of [
        `${type}: say why in the title`,
        `${type}(web): say why in the title`,
        `${type}!: say why in the title`,
        `${type}(web)!: say why in the title`,
      ]) {
        const result = runTitleCheck(title);
        expect(result.status, `"${title}" failed: ${result.stderr}`).toBe(0);
      }
    }
  });

  test("AC1: ci-pull-request.yml runs the check on the pull request's current title", () => {
    const workflow = readWorkflow("ci-pull-request.yml");
    const { step } = stepRunning(workflow, /check-pr-title\.mjs/);

    // The title is handed through the environment, never pasted into the
    // script, where a crafted title would run as shell.
    expect(step.run ?? "").not.toContain("github.event.pull_request.title");
    expect(Object.values(step.env ?? {})).toContain(
      "${{ github.event.pull_request.title }}",
    );

    // Renaming a pull request must re-run the check.
    const pullRequest = (workflow.on?.pull_request ?? {}) as {
      types?: string[];
    };
    expect(pullRequest.types ?? []).toContain("edited");
  });
});

describe("Issue #133: release-please keeps one release pull request", () => {
  type ReleaseConfig = {
    "include-component-in-tag"?: boolean;
    "include-v-in-tag"?: boolean;
    "skip-github-release"?: boolean;
    packages: Record<
      string,
      {
        "release-type"?: string;
        "changelog-path"?: string;
        "extra-files"?: (
          string | { type?: string; path?: string; jsonpath?: string }
        )[];
      }
    >;
  };

  test("AC2: release-please runs on every push to main with the release token", () => {
    const workflow = readWorkflow("release.yml");
    const push = (workflow.on?.push ?? {}) as { branches?: string[] };
    expect(push.branches).toEqual(["main"]);

    const { step } = stepUsing(workflow, /^googleapis\/release-please-action@/);
    // GITHUB_TOKEN would open a release pull request that starts no
    // pull_request workflow, so the required checks would never run.
    expect(step.with?.token).toBe("${{ secrets.ZIPNAMI_RELEASE_TOKEN }}");
    expect(step.with?.["config-file"]).toBe("release-please-config.json");
    expect(step.with?.["manifest-file"]).toBe(".release-please-manifest.json");
  });

  test("AC2: one version bumps the root and all four workspace package.json files", () => {
    const config = readJson<ReleaseConfig>("release-please-config.json");
    expect(Object.keys(config.packages)).toEqual(["."]);
    const root = config.packages["."];
    expect(root["release-type"]).toBe("node");
    expect(root["changelog-path"] ?? "CHANGELOG.md").toBe("CHANGELOG.md");

    const bumped = (root["extra-files"] ?? []).filter(
      (file) =>
        typeof file === "object" &&
        file.type === "json" &&
        file.jsonpath === "$.version",
    ) as { path: string }[];
    expect(bumped.map((file) => file.path).sort()).toEqual(
      WORKSPACES.map((workspace) => `${workspace}/package.json`).sort(),
    );

    const manifest = readJson<Record<string, string>>(
      ".release-please-manifest.json",
    );
    // Not pinned to 1.0.0: each release pull request moves the manifest and
    // every package.json forward together, and must still pass this check.
    expect(Object.keys(manifest)).toEqual(["."]);
    expect(manifest["."]).toMatch(/^\d+\.\d+\.\d+$/);
    for (const file of ["package.json", ...bumped.map((entry) => entry.path)]) {
      expect(readJson<{ version?: string }>(file).version, file).toBe(
        manifest["."],
      );
    }
  });

  test("AC3: merging the release pull request creates a vX.Y.Z tag and a GitHub Release", () => {
    const config = readJson<ReleaseConfig>("release-please-config.json");
    expect(config["include-component-in-tag"]).toBe(false);
    expect(config["include-v-in-tag"] ?? true).toBe(true);
    expect(config["skip-github-release"] ?? false).toBe(false);
  });
});

describe("Issue #133: the release run hands the owner a ready-to-post X link", () => {
  type Comment = { body: string };
  type FetchCall = { url: string; init: { method?: string; body?: string } };
  type Announce = (options: {
    version: string;
    comments: Comment[];
    webhookUrl: string;
    fetch: (
      url: string,
      init: FetchCall["init"],
    ) => Promise<{ ok: boolean; status: number }>;
  }) => Promise<void>;

  const recordingFetch = (status = 204) => {
    const calls: FetchCall[] = [];
    const fetch = async (url: string, init: FetchCall["init"]) => {
      calls.push({ url, init });
      return { ok: status >= 200 && status < 300, status };
    };
    return { calls, fetch };
  };

  const loadAnnounce = async (): Promise<Announce> => {
    const module = await loadModule<{ announceRelease?: Announce }>(
      announceScriptPath,
    );
    expect(
      typeof module.announceRelease,
      "announceRelease is not exported",
    ).toBe("function");
    return module.announceRelease as Announce;
  };

  const xPost = (text: string): Comment => ({
    body: `<!-- x-post -->\n${text}`,
  });

  // 128 CJK characters weigh 256, the space 1, and the URL 23: exactly 280.
  const longestText = `${"あ".repeat(128)} ${SITE}`;

  test("AC4: a valid x-post comment produces one Discord message with the version, the text, and an intent link", async () => {
    const announce = await loadAnnounce();
    const { calls, fetch } = recordingFetch();
    const text = `Zipnami 1.1.0 を公開しました。履歴を消せるようになりました。\n${SITE}`;

    await announce({
      version: "1.1.0",
      comments: [
        { body: "An unrelated comment" },
        xPost("An older draft https://zipnami.pages.dev"),
        xPost(text),
      ],
      webhookUrl: WEBHOOK,
      fetch,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(WEBHOOK);
    expect(calls[0].init.method).toBe("POST");
    const content = (
      JSON.parse(calls[0].init.body ?? "{}") as { content: string }
    ).content;
    expect(content).toContain("1.1.0");
    expect(content).toContain(text);

    const links =
      content.match(/https:\/\/x\.com\/intent\/post\?text=[^\s>)]+/g) ?? [];
    expect(links).toHaveLength(1);
    expect(new URL(links[0]).searchParams.get("text")).toBe(text);
  });

  test("AC4: a text of exactly 280 weighted characters is announced", async () => {
    const announce = await loadAnnounce();
    const { calls, fetch } = recordingFetch();

    await announce({
      version: "1.0.1",
      comments: [xPost(longestText)],
      webhookUrl: WEBHOOK,
      fetch,
    });

    expect(calls).toHaveLength(1);
  });

  test("AC5: a missing comment, an over-long text, or a text without the site sends nothing and fails", async () => {
    const announce = await loadAnnounce();

    for (const [why, comments] of [
      ["no x-post comment", [{ body: "Looks good" }]],
      ["281 weighted characters", [xPost(`${"あ".repeat(128)}い ${SITE}`)]],
      ["no link to the site", [xPost("Zipnami 1.0.1 を公開しました。")]],
      ["an empty x-post comment", [xPost("   ")]],
    ] as const) {
      const { calls, fetch } = recordingFetch();
      await expect(
        announce({
          version: "1.0.1",
          comments: [...comments],
          webhookUrl: WEBHOOK,
          fetch,
        }),
        why,
      ).rejects.toThrow();
      expect(calls, why).toHaveLength(0);
    }
  });

  test("AC5: a Discord error fails the job", async () => {
    const announce = await loadAnnounce();
    const { fetch } = recordingFetch(500);

    await expect(
      announce({
        version: "1.0.1",
        comments: [xPost(`Zipnami 1.0.1 ${SITE}`)],
        webhookUrl: WEBHOOK,
        fetch,
      }),
    ).rejects.toThrow();
  });

  test("AC4: the announcement runs in the same run that creates the release, only when it does", () => {
    const workflow = readWorkflow("release.yml");
    const release = stepUsing(workflow, /^googleapis\/release-please-action@/);
    const announce = stepRunning(workflow, /announce-release\.mjs/);

    const releaseId = release.step.id ?? "";
    expect(releaseId).not.toBe("");
    const gate = [
      workflow.jobs[announce.jobId].if ?? "",
      announce.step.if ?? "",
    ].join(" ");
    expect(gate).toMatch(/release_created/);
    expect(announce.step.env ?? {}).toMatchObject({
      DISCORD_WEBHOOK_URL: "${{ secrets.ZIPNAMI_DISCORD_WEBHOOK_URL }}",
    });
  });
});

describe("Issue #133: the changelog", () => {
  const changelog = () => readText("CHANGELOG.md");

  /** A version's entries: from its first ### heading to the next version. */
  const entriesOf = (text: string, heading: string): string => {
    const normalized = text.replace(/\r\n/g, "\n");
    const start = normalized.indexOf(`\n${heading}`);
    expect(start, `${heading} is missing`).toBeGreaterThanOrEqual(0);
    const next = normalized.indexOf("\n## ", start + 1);
    const section = normalized.slice(start + 1, next === -1 ? undefined : next);
    return section.slice(section.indexOf("### "));
  };

  test("AC6: the header says release-please writes it, no longer Keep a Changelog", () => {
    const header = changelog().slice(0, changelog().indexOf("\n## "));
    expect(header).not.toMatch(/keep a changelog/i);
    expect(header).toMatch(/release-please/);
    expect(header).toMatch(/Conventional Commits/);
  });

  test("AC6: the 1.0.0 section is unchanged", () => {
    // The SHA-256 of the section's entries as they stood on main when Issue
    // #133 started (7289c64). The heading and its intro paragraph are left
    // out: #132 dates the heading when it publishes v1.0.0, which is not a
    // change to what 1.0.0 contains.
    const digest = createHash("sha256")
      .update(entriesOf(changelog(), "## [1.0.0]"))
      .digest("hex");
    expect(digest).toBe(
      "dfebab80ac5aa764af4edbdadcd848518f9fe9e42114472bb625fbe80295e496",
    );
  });
});

describe("Issue #133: no secret leaves the secret store", () => {
  test("AC8: the workflows hand secrets to steps only through env and inputs", () => {
    for (const name of ["release.yml", "ci-pull-request.yml"]) {
      for (const { step } of allSteps(readWorkflow(name))) {
        expect(step.run ?? "", `${name}: ${step.name}`).not.toMatch(
          /secrets\./,
        );
      }
    }
  });

  test("AC8: a failed announcement does not print the webhook URL", async () => {
    const module = await loadModule<{
      announceRelease: (options: Record<string, unknown>) => Promise<void>;
    }>(announceScriptPath);

    for (const [status, comments] of [
      [500, [{ body: `<!-- x-post -->\nZipnami ${SITE}` }]],
      [204, []],
    ] as const) {
      const error = await module
        .announceRelease({
          version: "1.0.1",
          comments,
          webhookUrl: WEBHOOK,
          fetch: async () => ({ ok: status === 204, status }),
        })
        .then(
          () => undefined,
          (reason: unknown) => reason,
        );
      expect(String(error)).not.toContain("secret-token");
      expect(String(error)).not.toContain(WEBHOOK);
    }
  });
});
