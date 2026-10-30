<script setup lang="ts">
defineArt("./Counter.vue", {
  title: "Counter",
  category: "SubAppB",
  tags: ["demo", "keep-alive"],
});
</script>

<art>
  <variant default name="Default">
    <Counter />
  </variant>

  <variant name="Warm start">
    <Counter :initial="5" />
  </variant>
</art>
