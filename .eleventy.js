module.exports = function(eleventyConfig) {
    // Copy static assets
    eleventyConfig.addPassthroughCopy({
        "src/assets": "assets"
    });

    return {
        dir: {
            input: "src",
            output: "_site",
            includes: "_includes"
        },
        templateFormats: ["md", "njk", "html"],
        markdownTemplateEngine: "njk",
        htmlTemplateEngine: "njk",
        dataTemplateEngine: "njk"
    };
};
