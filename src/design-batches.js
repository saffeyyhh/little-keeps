export function parseDesignBatchNames(value) {
  const lines = String(value || "").replaceAll("\r", "").split("\n");
  const entries = [];
  let batchNumber = 1;
  let batchHasNames = false;

  lines.forEach(line => {
    const name = line.trim();
    if (!name) {
      if (batchHasNames) {
        batchNumber += 1;
        batchHasNames = false;
      }
      return;
    }
    entries.push({
      name,
      designBatchId: `batch-${batchNumber}`,
      designBatchNumber: batchNumber
    });
    batchHasNames = true;
  });

  return entries;
}

export function getDesignBatchGroups(items = []) {
  const groups = [];
  const byId = new Map();

  items.forEach((item, index) => {
    const id = item?.designBatchId || item?.design_batch_id || "batch-1";
    if (!byId.has(id)) {
      const group = {
        id,
        number: Number(item?.designBatchNumber || item?.design_batch_number) || groups.length + 1,
        items: [],
        indexes: []
      };
      byId.set(id, group);
      groups.push(group);
    }
    byId.get(id).items.push(item);
    byId.get(id).indexes.push(index);
  });

  return groups;
}

export function formatDesignBatchNames(items = []) {
  return getDesignBatchGroups(items)
    .map(group => group.items.map(item => item?.name || "").filter(Boolean).join("\n"))
    .filter(Boolean)
    .join("\n\n");
}
