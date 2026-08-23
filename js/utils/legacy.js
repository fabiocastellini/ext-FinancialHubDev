// utils/legacy.js


export function exposeLegacyFunctions(functions){
  Object.entries(functions).forEach(([name, fn]) => {
    window[name] = fn;
  });
}