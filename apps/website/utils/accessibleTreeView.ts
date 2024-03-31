// @ts-nocheck

import * as module from "react-accessible-treeview"

let TreeView: typeof module.default
let flattenTree: typeof module.flattenTree
let CLICK_ACTIONS: typeof module.CLICK_ACTIONS

if(typeof document == "undefined") {
  TreeView = module.default.default
  flattenTree = module.default.flattenTree
  CLICK_ACTIONS = module.default.CLICK_ACTIONS
}
else {
  TreeView = module.default
  flattenTree = module.flattenTree
  CLICK_ACTIONS = module.CLICK_ACTIONS
}

export { flattenTree, CLICK_ACTIONS }
export default TreeView