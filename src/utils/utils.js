export const extractBaseUrl = (json) => {
    if (json.url) {
      const match = json.url.match(/(https?:\/\/[^\/]+)/);
      return match ? match[0] + '/' : '';
    }
    return '';
};  

export const convertStyleStringToObject = (styleString) => {
if (!styleString) return {};

return styleString.split(';')
    .filter(style => style.trim())
    .reduce((acc, style) => {
    const [property, value] = style.split(':').map(str => str.trim());
    const camelCaseProperty = property.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
    acc[camelCaseProperty] = value;
    return acc;
    }, {});
};