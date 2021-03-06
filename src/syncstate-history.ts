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

export const enable = (path: string, ignore: Array<string | RegExp> = []) => {
  return {
    type: 'ENABLE_HISTORY',
    payload: {
      path,
      ignore,
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

export const getUndoablePath = (
  store: DocStore,
  pluginName: string,
  path: string
): string | null => {
  const undoablePaths: Array<string> = store.getStateAtPath(
    pluginName,
    '/undoablePaths'
  );
  let normalizedUndoablePath;

  if (undoablePaths.map(p => p.replaceAll('::', '/')).includes(path)) {
    normalizedUndoablePath = path; // exact match
  } else {
    const matchingUndoablePaths: Array<string> = [];
    undoablePaths.forEach((p: string) => {
      const normalizedPath = p.replaceAll('::', '/');
      if (path.startsWith(normalizedPath)) {
        matchingUndoablePaths.push(normalizedPath);
      }
    });

    let mostSpecificPath = matchingUndoablePaths.reduce(function(
      accumulator,
      currentValue
    ) {
      return currentValue.length > accumulator.length
        ? currentValue
        : accumulator; //  accumulator + currentValue
    },
    '');
    normalizedUndoablePath = mostSpecificPath;
  }

  const pathHistory: any = store.getStateAtPath(
    pluginName,
    '/paths/' + normalizedUndoablePath.replaceAll('/', '::')
  );

  let ignore = false;
  for (const ignoredPath of pathHistory?.ignoredPaths) {
    if (typeof ignoredPath === 'string') {
      const ignoreRegExp = new RegExp(ignoredPath);
      // console.log(ignoreRegExp, 'ignoreRegExp', path);

      ignore = ignoreRegExp.test(path);
      if (ignore) {
        break; // break loop if found ignore
      }
    }
  }

  if (ignore) {
    return null;
  }
  return normalizedUndoablePath;
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
      // if (!pathHistory[undoablePath]) {
      //   pathHistory[undoablePath] = {
      //     undo: [],
      //     redo: [],
      //   };
      // } else {
      pathHistory[undoablePath].redo = [];
      // }
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
          ignoredPaths: [],
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

      const getLastUndoPatch = () => {
        const patchArray = store.getStateAtPath(
          pluginName,
          '/paths/' + action.payload.path.replaceAll('/', '::') + '/undo'
        );
        return patchArray ? patchArray[patchArray.length - 1] : undefined;
      };

      const getLastRedoPatch = () => {
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
              const undoablePath = getUndoablePath(
                store,
                pluginName,
                action.payload.patch.path
              );

              if (undoablePath !== null) {
                addUndoPatch(setPathHistory, undoablePath, action.payload);
                clearRedoPatches(setPathHistory, undoablePath);
              }
            }
          }
          break;
        case 'INSERT_UNDO_BREAKPOINT':
          {
            const denormalizedPath = action.payload.path.replaceAll('/', '::');
            if (undoablePaths.includes(denormalizedPath)) {
              addUndoPatch(setPathHistory, denormalizedPath, {
                type: 'breakpoint',
              });
            }
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

            const redoPatchesToBeAdded = [];

            while (
              getLastUndoPatch() &&
              getLastUndoPatch().type !== 'breakpoint'
            ) {
              const undoPatchObj = getLastUndoPatch();

              removeUndoPatch(setPathHistory, action.payload.path);

              reduxStore.dispatch({
                type: 'PATCH',
                payload: {
                  patch: undoPatchObj.inversePatch,
                  patchType: 'NO_RECORD',
                  subtree: 'doc',
                },
              });

              redoPatchesToBeAdded.push(undoPatchObj);

              // addRedoPatch(setPathHistory, action.payload.path, undoPatchObj);
            }

            // checkpoint patch

            const undoPatchObj = getLastUndoPatch();

            if (undoPatchObj && undoPatchObj.type === 'breakpoint') {
              removeUndoPatch(setPathHistory, action.payload.path);

              redoPatchesToBeAdded.unshift(undoPatchObj);
              // addRedoPatch(setPathHistory, action.payload.path, undoPatchObj);
            }

            redoPatchesToBeAdded.forEach(redoPatch => {
              addRedoPatch(setPathHistory, action.payload.path, redoPatch);
            });
          }
          break;
        case 'UNDO':
          {
            // console.log(
            //   state.paths,
            //   action.payload,
            //   [action.payload.path.replaceAll('/', '::')],
            //   'state.paths'
            // );
            if (
              !state.paths[action.payload.path.replaceAll('/', '::')] ||
              !state.paths[action.payload.path.replaceAll('/', '::')].undo ||
              state.paths[action.payload.path.replaceAll('/', '::')].undo
                .length < 1
            ) {
              return;
            }

            while (
              getLastUndoPatch() &&
              getLastUndoPatch().type === 'breakpoint'
            ) {
              const lastUndoPatch = getLastUndoPatch();

              removeUndoPatch(setPathHistory, action.payload.path);

              addRedoPatch(setPathHistory, action.payload.path, lastUndoPatch);
            }

            const undoPatchObj = getLastUndoPatch();
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

            const undoPatchesToBeAdded = [];

            while (
              getLastRedoPatch() &&
              getLastRedoPatch().type !== 'breakpoint'
            ) {
              const redoPatchObj = getLastRedoPatch();

              removeRedoPatch(setPathHistory, action.payload.path);

              reduxStore.dispatch({
                type: 'PATCH',
                payload: {
                  patch: redoPatchObj.patch,
                  patchType: 'NO_RECORD',
                  subtree: 'doc',
                },
              });

              // addUndoPatch(setPathHistory, action.payload.path, redoPatchObj);

              undoPatchesToBeAdded.push(redoPatchObj);
            }

            const redoPatchObj = getLastRedoPatch();

            if (redoPatchObj && redoPatchObj.type === 'breakpoint') {
              removeRedoPatch(setPathHistory, action.payload.path);

              undoPatchesToBeAdded.unshift(redoPatchObj);
              // addUndoPatch(setPathHistory, action.payload.path, redoPatchObj);
            }

            undoPatchesToBeAdded.forEach(undoPatch => {
              addUndoPatch(setPathHistory, action.payload.path, undoPatch);
            });
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

            while (
              getLastRedoPatch() &&
              getLastRedoPatch().type === 'breakpoint'
            ) {
              const lastRedoPatch = getLastRedoPatch();
              removeRedoPatch(setPathHistory, action.payload.path);

              addUndoPatch(setPathHistory, action.payload.path, lastRedoPatch);
            }

            const redoPatchObj = getLastRedoPatch();
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
            const denormalizedPayloadPath = action.payload.path.replaceAll(
              '/',
              '::'
            );
            setUndoablePaths((undoablePaths: Array<string>) => {
              if (!undoablePaths.includes(denormalizedPayloadPath)) {
                undoablePaths.push(denormalizedPayloadPath);
              }
            });

            setPathHistory((pathHistory: any) => {
              if (!pathHistory[denormalizedPayloadPath]) {
                pathHistory[denormalizedPayloadPath] = {
                  undo: [],
                  redo: [],
                  ignoredPaths: [],
                };
              }

              pathHistory[denormalizedPayloadPath].ignoredPaths.push(
                ...action.payload.ignore
              );
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
