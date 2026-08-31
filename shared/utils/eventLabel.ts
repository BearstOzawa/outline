export function eventLabel(name: string, t: (key: string) => string) {
  const label = t(name);
  if (label === name) {
    return name.replaceAll(".", " ").replaceAll("_", " ");
  }
  return label;
}

export function eventGroupLabel(group: string, t: (key: string) => string) {
  const key = `eventGroup.${group}`;
  const label = t(key);
  if (label === key) {
    return group.replace(/s$/, "");
  }
  return label;
}
