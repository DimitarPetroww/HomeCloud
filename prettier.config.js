import base from "@homecloud/config/prettier";

/** @type {import("prettier").Config & import("prettier-plugin-tailwindcss").PluginOptions} */
export default {
  ...base,
  plugins: ["prettier-plugin-tailwindcss"],
};
