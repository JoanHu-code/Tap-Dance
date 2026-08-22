<script setup>
const props = defineProps({
  courseName: {
    type: String,
    required: true,
  },

  attendedCount: {
    type: Number,
    required: true,
  },

  totalSessions: {
    type: Number,
    required: true,
  },

  remainingSessions: {
    type: Number,
    required: true,
  },

  progressPercentage: {
    type: Number,
    required: true,
  },

  price: {
    type: Number,
    required: true,
  },
})

const formattedPrice = computed(() => {
  return new Intl.NumberFormat('zh-TW').format(props.price)
})
</script>

<template>
  <section class="course-card">
    <div class="course-card__header">
      <div>
        <span class="course-card__label">
          我的課程
        </span>

        <h1>
          {{ courseName }}
        </h1>
      </div>

      <div class="course-card__shoe">
        👞
      </div>
    </div>

    <div class="course-card__count">
      <strong>{{ attendedCount }}</strong>

      <span>/ {{ totalSessions }} 堂</span>
    </div>

    <div class="progress">
      <div
        class="progress__bar"
        :style="{
          width: `${progressPercentage}%`,
        }"
      />
    </div>

    <div class="course-card__details">
      <div>
        <span>剩餘堂數</span>
        <strong>{{ remainingSessions }} 堂</strong>
      </div>

      <div>
        <span>本期費用</span>
        <strong>${{ formattedPrice }}</strong>
      </div>
    </div>
  </section>
</template>

<style scoped>
.course-card {
  padding: 24px;
  background: #ffffff;
  border-radius: 24px;
  box-shadow: 0 8px 30px rgb(0 0 0 / 5%);
}

.course-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.course-card__label {
  color: #999999;
  font-size: 14px;
}

h1 {
  margin: 4px 0 0;
  font-size: 24px;
}

.course-card__shoe {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: #fff3f0;
  border-radius: 16px;
  font-size: 24px;
}

.course-card__count {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: 28px;
}

.course-card__count strong {
  font-size: 42px;
}

.course-card__count span {
  color: #777777;
}

.progress {
  height: 10px;
  margin-top: 12px;
  overflow: hidden;
  background: #eeeeee;
  border-radius: 999px;
}

.progress__bar {
  height: 100%;
  background: #222222;
  border-radius: 999px;
  transition: width 0.3s ease;
}

.course-card__details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 24px;
}

.course-card__details > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px;
  background: #fafafa;
  border-radius: 16px;
}

.course-card__details span {
  color: #888888;
  font-size: 13px;
}

.course-card__details strong {
  font-size: 17px;
}
</style>