import { SyncStateStore } from '@syncstate/core';

export const undo = () => {
  return {
    type: 'UNDO',
    payload: { path: [''] },
  };
};

export const redo = () => {
  return {
    type: 'REDO',
    payload: { path: [''] },
  };
};

export const undoPath = (path: Array<string | number>) => {
  return {
    type: 'UNDO',
    payload: { path: path },
  };
};
export const redoPath = (path: Array<string | number>) => {
  return {
    type: 'REDO',
    payload: { path: path },
  };
};

export const undoTillBreakpoint = () => {
  return {
    type: 'UNDO_TILL_BREAKPOINT',
    payload: { path: [''] },
  };
};

export const redoTillBreakpoint = () => {
  return {
    type: 'REDO_TILL_BREAKPOINT',
    payload: { path: [''] },
  };
};

export const undoPathTillBreakpoint = (path: Array<string | number>) => {
  return {
    type: 'UNDO_TILL_BREAKPOINT',
    payload: { path: path },
  };
};
export const redoPathTillBreakpoint = (path: Array<string | number>) => {
  return {
    type: 'REDO_TILL_BREAKPOINT',
    payload: { path: path },
  };
};

export const insertUndoBreakpoint = (path: Array<string | number> = []) => {
  return {
    type: 'INSERT_UNDO_BREAKPOINT',
    payload: { path: path },
  };
};

export const watchPath = (path: Array<string | number>) => {
  return {
    type: 'WATCH_PATH',
    payload: {
      path,
    },
  };
};

export const unwatchPath = (path: Array<string | number>) => {
  return {
    type: 'UNWATCH_PATH',
    payload: {
      path,
    },
  };
};

export const getUndoablePath = (
  store: SyncStateStore,
  pluginName: string,
  path: Array<string | number>
) => {
  let undoablePath = '';

  const undoablePaths = store.getStateAtPath(pluginName, ['undoablePaths']);

  undoablePaths.forEach((p: string) => {
    if (path.join('/').startsWith(p) && path.join('/') !== p) {
      undoablePath = p;
    }
  });

  return undoablePath;
};

function addUndoPatch(
  setPathHistory: any,
  undoablePath: string,
  change: { patch: any; inversePatch: any } | { type: 'breakpoint' }
) {
  setPathHistory((pathHistory: any) => {
    if (!pathHistory[undoablePath]) {
      pathHistory[undoablePath] = {
        undo: [],
        redo: [],
      };
    }

    pathHistory[undoablePath].undo.push(change);
  });
}

function addRedoPatch(
  setPathHistory: any,
  undoablePath: string,
  change: { patch: any; inversePatch: any }
) {
  setPathHistory((pathHistory: any) => {
    if (!pathHistory[undoablePath]) {
      pathHistory[undoablePath] = {
        undo: [],
        redo: [],
      };
    }

    pathHistory[undoablePath].redo.push(change);
  });
}
function removeUndoPatch(setPathHistory: any, undoablePath: string) {
  setPathHistory((pathHistory: any) => {
    pathHistory[undoablePath].undo.pop();
  });
}

function removeRedoPatch(setPathHistory: any, undoablePath: string) {
  setPathHistory((pathHistory: any) => {
    pathHistory[undoablePath].redo.pop();
  });
}

export const createPlugin = (conf: any = {}) => (store: SyncStateStore) => {
  const pluginName = conf.name ? conf.name : 'history';
  return {
    name: pluginName,
    middleware: (reduxStore: any) => (next: any) => (action: any) => {
      const state = store.getState(pluginName);
      const [pathHistory, setPathHistory] = store.useSyncState(pluginName, [
        'paths',
      ]);
      const [undoablePaths, setUndoablePaths] = store.useSyncState(pluginName, [
        'undoablePaths',
      ]);

      switch (action.type) {
        case 'PATCH':
          {
            if (
              action.payload.patchType !== 'NO_RECORD' &&
              action.payload.subtree === 'doc'
            ) {
              const undoablePath = getUndoablePath(
                store,
                pluginName,
                action.payload.patch.path
              );
              if (undoablePath !== undefined) {
                addUndoPatch(setPathHistory, undoablePath, action.payload);
              }
            }
          }
          break;
        case 'INSERT_UNDO_BREAKPOINT':
          {
            addUndoPatch(setPathHistory, action.payload.path.join('/'), {
              type: 'breakpoint',
            });
          }
          break;
        case 'UNDO_TILL_BREAKPOINT':
          {
            if (
              !state.paths[action.payload.path.join('/')].undo ||
              state.paths[action.payload.path.join('/')].undo.length < 1
            ) {
              return;
            }

            const lastUndoPatch = () => {
              const patchArray = store.getStateAtPath(pluginName, [
                'paths',
                action.payload.path.join('/'),
                'undo',
              ]);
              return patchArray ? patchArray[patchArray.length - 1] : undefined;
            };

            while (lastUndoPatch() && lastUndoPatch().type !== 'breakpoint') {
              const undoPatchObj = lastUndoPatch();

              removeUndoPatch(setPathHistory, action.payload.path.join('/'));

              reduxStore.dispatch({
                type: 'PATCH',
                payload: {
                  patch: undoPatchObj.inversePatch,
                  patchType: 'NO_RECORD',
                  subtree: 'doc',
                },
              });

              addRedoPatch(
                setPathHistory,
                action.payload.path.join('/'),
                undoPatchObj
              );
            }

            // checkpoint patch

            if (lastUndoPatch() && lastUndoPatch().type === 'breakpoint') {
              removeUndoPatch(setPathHistory, action.payload.path.join('/'));

              addRedoPatch(
                setPathHistory,
                action.payload.path.join('/'),
                lastUndoPatch()
              );
            }
          }
          break;
        case 'UNDO':
          {
            if (
              !state.paths[action.payload.path.join('/')].undo ||
              state.paths[action.payload.path.join('/')].undo.length < 1
            ) {
              return;
            }

            const lastUndoPatch = () => {
              const patchArray = store.getStateAtPath(pluginName, [
                'paths',
                action.payload.path.join('/'),
                'undo',
              ]);
              return patchArray ? patchArray[patchArray.length - 1] : undefined;
            };

            while (lastUndoPatch() && lastUndoPatch().type === 'breakpoint') {
              removeUndoPatch(setPathHistory, action.payload.path.join('/'));

              addRedoPatch(
                setPathHistory,
                action.payload.path.join('/'),
                lastUndoPatch()
              );
            }

            const undoPatchObj = lastUndoPatch();
            if (!undoPatchObj) {
              break;
            }
            removeUndoPatch(setPathHistory, action.payload.path.join('/'));

            reduxStore.dispatch({
              type: 'PATCH',
              payload: {
                patch: undoPatchObj.inversePatch,
                patchType: 'NO_RECORD',
                subtree: 'doc',
              },
            });

            addRedoPatch(
              setPathHistory,
              action.payload.path.join('/'),
              undoPatchObj
            );
          }
          break;
        case 'REDO_TILL_BREAKPOINT':
          {
            if (
              !state.paths[action.payload.path.join('/')].redo ||
              state.paths[action.payload.path.join('/')].redo.length < 1
            ) {
              return;
            }

            const lastRedoPatch = () => {
              const patchArray = store.getStateAtPath(pluginName, [
                'paths',
                action.payload.path.join('/'),
                'redo',
              ]);
              return patchArray ? patchArray[patchArray.length - 1] : undefined;
            };

            while (lastRedoPatch() && lastRedoPatch().type !== 'breakpoint') {
              const redoPatchObj = lastRedoPatch();

              removeRedoPatch(setPathHistory, action.payload.path.join('/'));

              reduxStore.dispatch({
                type: 'PATCH',
                payload: {
                  patch: redoPatchObj.patch,
                  patchType: 'NO_RECORD',
                  subtree: 'doc',
                },
              });

              addUndoPatch(
                setPathHistory,
                action.payload.path.join('/'),
                redoPatchObj
              );
            }

            if (lastRedoPatch() && lastRedoPatch().type === 'breakpoint') {
              removeRedoPatch(setPathHistory, action.payload.path.join('/'));

              addUndoPatch(
                setPathHistory,
                action.payload.path.join('/'),
                lastRedoPatch()
              );
            }
          }
          break;
        case 'REDO':
          {
            if (
              !state.paths[action.payload.path.join('/')].redo ||
              state.paths[action.payload.path.join('/')].redo.length < 1
            ) {
              return;
            }

            const lastRedoPatch = () => {
              const patchArray = store.getStateAtPath(pluginName, [
                'paths',
                action.payload.path.join('/'),
                'redo',
              ]);
              return patchArray ? patchArray[patchArray.length - 1] : undefined;
            };

            while (lastRedoPatch() && lastRedoPatch().type === 'breakpoint') {
              removeRedoPatch(setPathHistory, action.payload.path.join('/'));

              addUndoPatch(
                setPathHistory,
                action.payload.path.join('/'),
                lastRedoPatch()
              );
            }

            const redoPatchObj = lastRedoPatch();
            if (!redoPatchObj) {
              break;
            }

            removeRedoPatch(setPathHistory, action.payload.path.join('/'));

            reduxStore.dispatch({
              type: 'PATCH',
              payload: {
                patch: redoPatchObj.patch,
                patchType: 'NO_RECORD',
                subtree: 'doc',
              },
            });

            addUndoPatch(
              setPathHistory,
              action.payload.path.join('/'),
              redoPatchObj
            );
          }
          break;

        case 'WATCH_PATH':
          {
            setUndoablePaths((undoablePaths: Array<string>) => {
              if (!undoablePaths.includes(action.payload.path.join('/'))) {
                undoablePaths.push(action.payload.path.join('/'));
              }
            });
          }
          break;
        case 'UNWATCH_PATH':
          {
            setUndoablePaths((undoablePaths: Array<string>) => {
              undoablePaths.forEach((p, index) => {
                if (p === action.payload.path.join('/')) {
                  undoablePaths.splice(index, 1);
                }
              });
            });
          }
          break;
      }

      let result = next(action);
      // if (
      //   (action.type === 'PATCHES' || action.type === 'SINGLE_PATCH') &&
      //   store.getState().loaded
      // ) {
      //   store.getState().socket.emit('patches', action.payload);
      // }

      // @ts-ignore
      window['historyPatches'] = store.getState(pluginName).paths;

      return result;
    },
    // reducer: {
    //   name: pluginName,
    //   reducer: historyReducer,
    // },
  };
};

// export function historyReducer(
//   state: {
//     state: {
//       paths: {
//         [key: string]: {
//           undo: any[];
//           redo: any[];
//         };
//       };
//       undoablePaths: Array<string>;
//     };
//     patches: Array<any>;
//   } = {
//     state: {
//       paths: {
//         '': {
//           undo: [],
//           redo: [],
//         },
//       },
//       undoablePaths: [],
//     },
//     patches: [],
//   },
//   action: any
// ) {
//   switch (action.type) {
//     // case 'ADD_UNDO_PATCH':
//     //   return produce(state, draftState => {
//     //     if (!draftState.state.paths[action.payload.undoablePath]) {
//     //       draftState.state.paths[action.payload.undoablePath] = {
//     //         undo: [],
//     //         redo: [],
//     //       };
//     //     }
//     //     draftState.state.paths[action.payload.undoablePath].undo.push(
//     //       action.payload.patchObj
//     //     );
//     //   });

//     // case 'ADD_REDO_PATCH':
//     //   return produce(state, draftState => {
//     //     if (!draftState.state.paths[action.payload.undoablePath]) {
//     //       draftState.state.paths[action.payload.undoablePath] = {
//     //         undo: [],
//     //         redo: [],
//     //       };
//     //     }
//     //     draftState.state.paths[action.payload.undoablePath].redo.push(
//     //       action.payload.patchObj
//     //     );
//     //   });
//     // case 'POP_UNDO_PATCH':
//     //   return produce(state, draftState => {
//     //     if (draftState.state.paths[action.payload.undoablePath].undo) {
//     //       draftState.state.paths[action.payload.undoablePath].undo.pop();
//     //     }
//     //   });
//     // case 'POP_REDO_PATCH':
//     //   return produce(state, draftState => {
//     //     if (!draftState.state.paths[action.payload.undoablePath].redo) {
//     //       draftState.state.paths[action.payload.undoablePath].redo.pop();
//     //     }
//     //   });

//     // case 'WATCH_PATH':
//     //   return produce(state, draftState => {
//     //     if (
//     //       !draftState.state.undoablePaths.includes(
//     //         action.payload.path.join('/')
//     //       )
//     //     ) {
//     //       draftState.state.undoablePaths.push(action.payload.path.join('/'));
//     //     }
//     //   });
//     // case 'UNWATCH_PATH':
//     //   return produce(state, draftState => {
//     //     draftState.state.undoablePaths.forEach((p, index) => {
//     //       if (p === action.payload.path.join('/')) {
//     //         draftState.state.undoablePaths.splice(index, 1);
//     //       }
//     //     });
//     //   });

//     default:
//       return state;
//   }
// }
