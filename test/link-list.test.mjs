import assert from "node:assert/strict";
import test from "node:test";
import { groupLinksByCategory, paginateItems } from "../src/app/linkList.js";

test("groups links by category order and keeps uncategorized links last", () => {
  const categories = [
    { id: 2, name: "B", sortOrder: 20 },
    { id: 1, name: "A", sortOrder: 10 }
  ];
  const links = [
    { id: 1, title: "B1", categoryId: 2, sortOrder: 20 },
    { id: 2, title: "A1", categoryId: 1, sortOrder: 10 },
    { id: 3, title: "X", categoryId: 99, sortOrder: 30 }
  ];

  const groups = groupLinksByCategory(categories, links);

  assert.deepEqual(groups.map((group) => group.name), ["A", "B", "未分类"]);
  assert.deepEqual(groups.map((group) => group.links.map((link) => link.title)), [["A1"], ["B1"], ["X"]]);
});

test("paginates long category link lists", () => {
  const items = Array.from({ length: 13 }, (_, index) => ({ id: index + 1 }));

  assert.deepEqual(paginateItems(items, 1, 5).items.map((item) => item.id), [1, 2, 3, 4, 5]);
  assert.deepEqual(paginateItems(items, 3, 5).items.map((item) => item.id), [11, 12, 13]);
  assert.equal(paginateItems(items, 99, 5).page, 3);
  assert.equal(paginateItems(items, 1, 5).pageCount, 3);
});
