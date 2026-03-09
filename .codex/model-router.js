'use strict';

function parsePolicy() {
  const raw = process.env.BABYSITTER_MODEL_POLICY_JSON;
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function resolveModelForTask(task, phase) {
  const explicit = task && (task.model || (task.agent && task.agent.model));
  if (explicit) return explicit;
  const policy = parsePolicy();
  if (phase && policy[phase]) return policy[phase];
  return process.env.BABYSITTER_MODEL_DEFAULT || null;
}

module.exports = {
  resolveModelForTask,
};
