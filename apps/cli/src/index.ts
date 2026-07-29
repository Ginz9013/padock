#!/usr/bin/env -S node
import { Command } from "commander";
import { version } from "../package.json";
import { registerLoginCommand, registerWhoamiCommand } from "./commands/login.ts";
import { registerProjectCommands } from "./commands/project.ts";
import { registerTaskCommands } from "./commands/task.ts";
import { registerDocCommands } from "./commands/doc.ts";
import { registerChatCommands } from "./commands/chat.ts";
import { registerUserCommands } from "./commands/user.ts";
import { registerSearchCommand } from "./commands/search.ts";
import { registerInitSkillCommand } from "./commands/init-skill.ts";
import { registerChannelCommands } from "./commands/channel.ts";
import { registerTopicCommands } from "./commands/topic.ts";
import { registerTaskStateCommands } from "./commands/task-state.ts";

const program = new Command();

program.name("padock").description("Padock CLI — CONTEXT.md §5.2").version(version);

registerLoginCommand(program);
registerWhoamiCommand(program);
registerProjectCommands(program);
registerTaskCommands(program);
registerDocCommands(program);
registerChatCommands(program);
registerUserCommands(program);
registerSearchCommand(program);
registerInitSkillCommand(program);
registerChannelCommands(program);
registerTopicCommands(program);
registerTaskStateCommands(program);

program.parseAsync(process.argv);
