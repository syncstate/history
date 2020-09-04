import { DocStore } from '@syncstate/core';

export const undo = () => {
  return {
    type: 'UNDO',
    payload: { path: '' },
  };
};

export const redo = () => {
  return {
    type: 'REDO',
    payload: { path: '' },
  };
};

export const undoPath = (path: string) => {
  return {
    type: 'UNDO',
    payload: { path: path },
  };
};
export const redoPath = (path: string) => {
  return {
    type: 'REDO',
    payload: { path: path },
  };
};

export const undoTillBreakpoint = () => {
  return {
    type: 'UNDO_TILL_BREAKPOINT',
    payload: { path: '' },
  };
};

export const redoTillBreakpoint = () => {
  return {
    type: 'REDO_TILL_BREAKPOINT',
    payload: { path: '' },
  };
};

export const undoPathTillBreakpoint = (path: string) => {
  return {
    type: 'UNDO_TILL_BREAKPOINT',
    payload: { path: path },
  };
};
export const redoPathTillBreakpoint = (path: string) => {
  return {
    type: 'REDO_TILL_BREAKPOINT',
    payload: { path: path },
  };
};

export const insertUndoBreakpoint = (path: string = '') => {
  return {
    type: 'INSERT_UNDO_BREAKPOINT',
    payload: { path: path },
  };
};

export const enable = (path: string) => {
  return {
    type: 'ENABLE_HISTORY',
    payload: {
      path,
    },
  };
};

export const disable = (path: string) => {
  return {
    type: 'DISABLE_HISTORY',
    payload: {
      path,
    },
  };
};

export const getUndoablePaths = (
  store: DocStore,
  pluginName: string,
  path: string
) => {
  let matchingUndoablePaths: Array<string> = [];

  const undoablePaths = store.getStateAtPath(pluginName, '/undoablePaths');

  undoablePaths.forEach((p: string) => {
    if (
      path.startsWith(p.replaceAll('::', '/')) &&
      path !== p.replaceAll('::', '/')
    ) {
      matchingUndoablePaths.push(p.replaceAll('::', '/'));
    }
  });

  return matchingUndoablePaths;
};

function addUndoPatch(
  setPathHistory: any,
  undoablePaths: string | string[],
  change: { patch: any; inversePatch: any } | { type: 'breakpoint' }
) {
  if (!Array.isArray(undoablePaths)) {
    undoablePaths = [undoablePaths];
  }

  undoablePaths.forEach(undoablePath => {
    undoablePath = undoablePath.replaceAll('/', '::'); // interferes with JSON patch path
    setPathHistory((pathHistory: any) => {
      if (!pathHistory[undoablePath]) {
        pathHistory[undoablePath] = {
          undo: [],
          redo: [],
        };
      }

      pathHistory[undoablePath].undo.push(change);
    });
  });
}

function addRedoPatch(
  setPathHistory: any,
  undoablePath: string,
  change: { patch: any; inversePatch: any }
) {
  undoablePath = undoablePath.replaceAll('/', '::'); // interferes with JSON patch path
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
  undoablePath = undoablePath.replaceAll('/', '::'); // interferes with JSON patch path
  setPathHistory((pathHistory: any) => {
    pathHistory[undoablePath].undo.pop();
  });
}

function removeRedoPatch(setPathHistory: any, undoablePath: string) {
  undoablePath = undoablePath.replaceAll('/', '::'); // interferes with JSON patch path
  setPathHistory((pathHistory: any) => {
    pathHistory[undoablePath].redo.pop();
  });
}

function clearRedoPatches(
  setPathHistory: any,
  undoablePaths: string | string[]
) {
  if (!Array.isArray(undoablePaths)) {
    undoablePaths = [undoablePaths];
  }

  undoablePaths.forEach(undoablePath => {
    undoablePath = undoablePath.replaceAll('/', '::'); // interferes with JSON patch path
    setPathHistory((pathHistory: any) => {
      if (!pathHistory[undoablePath]) {
        pathHistory[undoablePath] = {
          undo: [],
          redo: [],
        };
      } else {
        pathHistory[undoablePath].redo = [];
      }
    });
  });
}

export const createInitializer = (pluginName: string = 'history') => (
  store: DocStore
) => {
  return {
    name: pluginName,
    initialState: {
      paths: {
        '': {
          undo: [],
          redo: [],
        },
      },
      undoablePaths: [''],
    },
    middleware: (reduxStore: any) => (next: any) => (action: any) => {
      if (action.type === 'CREATE_SUBTREE') {
        return next(action);
      }
      const state = store.getState(pluginName);
      const [pathHistory, setPathHistory] = store.useSyncState(
        pluginName,
        '/paths'
      );
      const [undoablePaths, setUndoablePaths] = store.useSyncState(
        pluginName,
        '/undoablePaths'
      );

      const lastUndoPatch = () => {
        const patchArray = store.getStateAtPath(
          pluginName,
          '/paths/' + action.payload.path.replaceAll('/', '::') + '/undo'
        );
        return patchArray ? patchArray[patchArray.length - 1] : undefined;
      };

      const lastRedoPatch = () => {
        const patchArray = store.getStateAtPath(
          pluginName,
          '/paths/' + action.payload.path.replaceAll('/', '::') + '/redo'
        );
        return patchArray ? patchArray[patchArray.length - 1] : undefined;
      };

      switch (action.type) {
        case 'PATCH':
          {
            if (
              action.payload.patchType !== 'NO_RECORD' &&
              action.payload.subtree === 'doc'
            ) {
              const undoablePaths = getUndoablePaths(
                store,
                pluginName,
                action.payload.patch.path
              );

              addUndoPatch(setPathHistory, undoablePaths, action.payload);
              clearRedoPatches(setPathHistory, undoablePaths);
            }
          }
          break;
        case 'INSERT_UNDO_BREAKPOINT':
          {
            addUndoPatch(
              setPathHistory,
              action.payload.path.replaceAll('/', '::'),
              {
                type: 'breakpoint',
              }
            );
          }
          break;
        case 'UNDO_TILL_BREAKPOINT':
          {
            if (
              !state.paths[action.payload.path.replaceAll('/', '::')] ||
              !state.paths[action.payload.path.replaceAll('/', '::')].undo ||
              state.paths[action.payload.path.replaceAll('/', '::')].undo
                .length < 1
            ) {
              return;
            }

            while (lastUndoPatch() && lastUndoPatch().type !== 'breakpoint') {
              const undoPatchObj = lastUndoPatch();

              removeUndoPatch(setPathHistory, action.payload.path);

              reduxStore.dispatch({
                type: 'PATCH',
                payload: {
                  patch: undoPatchObj.inversePatch,
                  patchType: 'NO_RECORD',
                  subtree: 'doc',
                },
              });

              addRedoPatch(setPathHistory, action.payload.path, undoPatchObj);
            }

            // checkpoint patch

            if (lastUndoPatch() && lastUndoPatch().type === 'breakpoint') {
              removeUndoPatch(setPathHistory, action.payload.path);

              addRedoPatch(
                setPathHistory,
                action.payload.path,
                lastUndoPatch()
              );
            }
          }
          break;
        case 'UNDO':
          {
            if (
              !state.paths[action.payload.path.replaceAll('/', '::')] ||
              !state.paths[action.payload.path.replaceAll('/', '::')].undo ||
              state.paths[action.payload.path.replaceAll('/', '::')].undo
                .length < 1
            ) {
              return;
            }

            while (lastUndoPatch() && lastUndoPatch().type === 'breakpoint') {
              removeUndoPatch(setPathHistory, action.payload.path);

              addRedoPatch(
                setPathHistory,
                action.payload.path,
                lastUndoPatch()
              );
            }

            const undoPatchObj = lastUndoPatch();
            if (!undoPatchObj) {
              break;
            }
            removeUndoPatch(setPathHistory, action.payload.path);

            reduxStore.dispatch({
              type: 'PATCH',
              payload: {
                patch: undoPatchObj.inversePatch,
                patchType: 'NO_RECORD',
                subtree: 'doc',
              },
            });

            addRedoPatch(setPathHistory, action.payload.path, undoPatchObj);
          }
          break;
        case 'REDO_TILL_BREAKPOINT':
          {
            if (
              !state.paths[action.payload.path.replaceAll('/', '::')] ||
              !state.paths[action.payload.path.replaceAll('/', '::')].redo ||
              state.paths[action.payload.path.replaceAll('/', '::')].redo
                .length < 1
            ) {
              return;
            }

            while (lastRedoPatch() && lastRedoPatch().type !== 'breakpoint') {
              const redoPatchObj = lastRedoPatch();

              removeRedoPatch(setPathHistory, action.payload.path);

              reduxStore.dispatch({
                type: 'PATCH',
                payload: {
                  patch: redoPatchObj.patch,
                  patchType: 'NO_RECORD',
                  subtree: 'doc',
                },
              });

              addUndoPatch(setPathHistory, action.payload.path, redoPatchObj);
            }

            if (lastRedoPatch() && lastRedoPatch().type === 'breakpoint') {
              removeRedoPatch(setPathHistory, action.payload.path);

              addUndoPatch(
                setPathHistory,
                action.payload.path,
                lastRedoPatch()
              );
            }
          }
          break;
        case 'REDO':
          {
            if (
              !state.paths[action.payload.path.replaceAll('/', '::')] ||
              !state.paths[action.payload.path.replaceAll('/', '::')].redo ||
              state.paths[action.payload.path.replaceAll('/', '::')].redo
                .length < 1
            ) {
              return;
            }

            while (lastRedoPatch() && lastRedoPatch().type === 'breakpoint') {
              removeRedoPatch(setPathHistory, action.payload.path);

              addUndoPatch(
                setPathHistory,
                action.payload.path,
                lastRedoPatch()
              );
            }

            const redoPatchObj = lastRedoPatch();
            if (!redoPatchObj) {
              break;
            }

            removeRedoPatch(setPathHistory, action.payload.path);

            reduxStore.dispatch({
              type: 'PATCH',
              payload: {
                patch: redoPatchObj.patch,
                patchType: 'NO_RECORD',
                subtree: 'doc',
              },
            });

            addUndoPatch(setPathHistory, action.payload.path, redoPatchObj);
          }
          break;

        case 'ENABLE_HISTORY':
          {
            setUndoablePaths((undoablePaths: Array<string>) => {
              if (
                !undoablePaths.includes(
                  action.payload.path.replaceAll('/', '::')
                )
              ) {
                undoablePaths.push(action.payload.path.replaceAll('/', '::'));
              }
            });
          }
          break;
        case 'DISABLE_HISTORY':
          {
            setUndoablePaths((undoablePaths: Array<string>) => {
              undoablePaths.forEach((p, index) => {
                if (p === action.payload.path.replaceAll('/', '::')) {
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
  };
};
