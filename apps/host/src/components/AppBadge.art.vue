<script setup lang="ts">
defineArt("./AppBadge.vue", {
  title: "AppBadge",
  category: "Host",
  tags: ["sidebar"],
});
</script>

<art>
  <variant default name="Active">
    <AppBadge active color="#5b8ff9" label="子应用 A" />
  </variant>

  <variant name="Inactive">
    <AppBadge color="#5b8ff9" label="子应用 A" />
  </variant>
</art>
