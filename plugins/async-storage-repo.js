const { withProjectBuildGradle } = require('@expo/config-plugins');

/**
 * Adds AsyncStorage 3.x local Maven repository to android/build.gradle.
 * AsyncStorage 3.x publishes org.asyncstorage.shared_storage to a local repo
 * inside node_modules that Gradle needs to know about.
 */
function withAsyncStorageRepo(config) {
  return withProjectBuildGradle(config, (mod) => {
    if (mod.modResults.language === 'groovy') {
      const repo =
        'maven { url = uri(project(":react-native-async-storage_async-storage").file("local_repo")) }';
      if (!mod.modResults.contents.includes('async-storage')) {
        mod.modResults.contents = mod.modResults.contents.replace(
          /allprojects\s*\{\s*repositories\s*\{/,
          `allprojects {\n  repositories {\n    ${repo}`
        );
      }
    }
    return mod;
  });
}

module.exports = withAsyncStorageRepo;
