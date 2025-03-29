import { createFromRoot } from "codama";
import { renderVisitor } from "@codama/renderers-js";
import { rootNodeFromAnchor, rootNodeFromAnchorV00, rootNodeFromAnchorV01 } from "@codama/nodes-from-anchor";
import { readFileSync } from "fs";

const idl = JSON.parse(readFileSync("../../anchor-program/target/idl/whirlpool_cpi.json", "utf8"));
// IDL generated with anchor 0.29 does not have the metadata field so we have to add it manually
const node = rootNodeFromAnchorV01({
    ...idl
});

const visitor = renderVisitor("./codama/generated");
const codama = createFromRoot(node);
codama.accept(visitor);

