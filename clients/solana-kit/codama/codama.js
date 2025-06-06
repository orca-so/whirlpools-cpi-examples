import { createFromRoot } from "codama";
import { renderVisitor } from "@codama/renderers-js";
import { rootNodeFromAnchor } from "@codama/nodes-from-anchor";
import { readFileSync } from "fs";

const idl = JSON.parse(readFileSync("../../anchor-program/target/idl/whirlpool_cpi.json", "utf8"));
// IDL generated with anchor 0.29 does not have the metadata field so we have to add it manually
const updatedIdl = idl.metadata ? {
    ...idl,
    name: "whirlpool_cpi",
} : {
    ...idl,
    metadata: {
        address: "23WKGEsTRVZiVuwg8eyXByPq2xkzTR8v6TW4V1WiT89g",
        origin: "anchor",
    },
};
const node = rootNodeFromAnchor(
    updatedIdl
);

const visitor = renderVisitor("./codama/generated");
const codama = createFromRoot(node);
codama.accept(visitor);

