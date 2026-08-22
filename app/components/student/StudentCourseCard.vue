<script setup>
const props =
  defineProps({
    course: {
      type: Object,
      required: true,
    },

    renewLoadingPackageId: {
      type: String,
      default: null,
    },
  })

const emit =
  defineEmits([
    'renew',
  ])

// ============================================================
// Package
// ============================================================

const packageData =
  computed(() => {
    return (
      props.course
        ?.package ||
      null
    )
  })

const totalSessions =
  computed(() => {
    return Number(
      packageData.value
        ?.total_sessions ||
      0
    )
  })

const attendedCount =
  computed(() => {
    return Number(
      packageData.value
        ?.attended_count ||
      0
    )
  })

const remainingSessions =
  computed(() => {
    return Math.max(
      totalSessions.value -
        attendedCount.value,
      0
    )
  })

const progressPercentage =
  computed(() => {
    if (
      totalSessions.value <=
      0
    ) {
      return 0
    }

    return Math.min(
      Math.round(
        (
          attendedCount.value /
          totalSessions.value
        ) *
          100
      ),
      100
    )
  })

// ============================================================
// Renew
//
// 必須：
// 有 Package
// total > 0
// attended >= total
// 非 CANCELLED
// ============================================================

const canRenew =
  computed(() => {
    if (
      !packageData.value
    ) {
      return false
    }

    return (
      totalSessions.value >
        0 &&
      attendedCount.value >=
        totalSessions.value &&
      packageData.value
        .status !==
        'CANCELLED'
    )
  })

const renewLoading =
  computed(() => {
    return (
      Boolean(
        packageData.value
          ?.id
      ) &&
      String(
        props
          .renewLoadingPackageId ||
        ''
      ) ===
        String(
          packageData.value
            ?.id ||
          ''
        )
    )
  })

// ============================================================
// Money
// ============================================================

const formatMoney =
  (
    value
  ) => {
    return new Intl
      .NumberFormat(
        'zh-TW'
      )
      .format(
        Number(
          value || 0
        )
      )
  }

// ============================================================
// Weekday
// ============================================================

const getWeekdayLabel =
  (
    weekday
  ) => {
    const map = {
      1: '星期一',
      2: '星期二',
      3: '星期三',
      4: '星期四',
      5: '星期五',
      6: '星期六',
      7: '星期日',
    }

    return (
      map[
        Number(
          weekday
        )
      ] ||
      ''
    )
  }

// ============================================================
// Schedule
// ============================================================

const getScheduleText =
  (
    schedule
  ) => {
    const weekday =
      getWeekdayLabel(
        schedule.weekday
      )

    const startTime =
      String(
        schedule.start_time ||
        ''
      )
        .slice(
          0,
          5
        )

    const endTime =
      schedule.end_time
        ? String(
            schedule.end_time
          )
            .slice(
              0,
              5
            )
        : ''

    if (
      startTime &&
      endTime
    ) {
      return `${weekday} ${startTime} - ${endTime}`
    }

    if (startTime) {
      return `${weekday} ${startTime}`
    }

    return weekday
  }

const handleRenew =
  () => {
    if (
      !canRenew.value ||
      renewLoading.value
    ) {
      return
    }

    emit(
      'renew',
      props.course
    )
  }
</script>

<template>
  <article
    class="
      course-card
    "
  >
    <div
      class="
        course-header
      "
    >
      <div>
        <span
          class="
            course-label
          "
        >
          Course
        </span>

        <h2>
          {{
            course.courseName
          }}
        </h2>

        <p
          v-if="
            course.courseDescription
          "
        >
          {{
            course.courseDescription
          }}
        </p>
      </div>

      <div
        v-if="
          packageData
        "
        class="
          cycle-badge
        "
      >
        第
        {{
          packageData
            .cycle_no ||
          1
        }}
        期
      </div>
    </div>

    <!-- ======================================================
         多固定時段
         ====================================================== -->

    <div
      class="
        schedules
      "
    >
      <span
        class="
          schedules__title
        "
      >
        固定上課時段
      </span>

      <div
        v-if="
          course.schedules
            ?.length
        "
        class="
          schedule-list
        "
      >
        <div
          v-for="
            schedule in
              course.schedules
          "
          :key="
            schedule.schedule_id
          "
          class="
            schedule-chip
          "
          :class="{
            'schedule-chip--primary':
              schedule.is_primary,
          }"
        >
          <span>
            {{
              getScheduleText(
                schedule
              )
            }}
          </span>

          <small
            v-if="
              schedule.is_primary
            "
          >
            主要
          </small>
        </div>
      </div>

      <div
        v-else
        class="
          no-schedule
        "
      >
        尚未設定固定班別
      </div>
    </div>

    <!-- ======================================================
         無 Package
         ====================================================== -->

    <div
      v-if="
        !packageData
      "
      class="
        no-package
      "
    >
      <strong>
        尚未建立堂數方案
      </strong>

      <p>
        老師尚未替這門課設定堂數與價格。
      </p>
    </div>

    <!-- ======================================================
         Package
         ====================================================== -->

    <template
      v-else
    >
      <div
        class="
          progress-header
        "
      >
        <div>
          <span>
            本期堂數
          </span>

          <strong>
            {{
              attendedCount
            }}
            /
            {{
              totalSessions
            }}
          </strong>
        </div>

        <div
          class="
            remaining
          "
        >
          剩餘

          <strong>
            {{
              remainingSessions
            }}
          </strong>

          堂
        </div>
      </div>

      <div
        class="
          progress-track
        "
      >
        <div
          class="
            progress-value
          "
          :style="{
            width:
              `${progressPercentage}%`,
          }"
        />
      </div>

      <div
        class="
          progress-footer
        "
      >
        <span>
          {{
            progressPercentage
          }}%
        </span>

        <span>
          NT$
          {{
            formatMoney(
              packageData.price
            )
          }}
        </span>
      </div>

      <!-- ====================================================
           Renew
           ==================================================== -->

      <div
        v-if="
          canRenew
        "
        class="
          renew-box
        "
      >
        <strong>
          本期堂數已完成
        </strong>

        <p>
          若已完成繳費，可以開始下一期。
        </p>

        <button
          type="button"
          class="
            renew-button
          "
          :disabled="
            renewLoading
          "
          @click="
            handleRenew
          "
        >
          {{
            renewLoading
              ? '續期處理中...'
              : '已繳費，開始下一期'
          }}
        </button>
      </div>
    </template>

    <!-- ======================================================
         Bank
         ====================================================== -->

    <div
      v-if="
        course.bankAccount
      "
      class="
        bank-box
      "
    >
      <div>
        <span>
          繳費帳戶
        </span>

        <strong>
          {{
            course
              .bankAccount
              .bank_name
          }}
        </strong>
      </div>

      <div>
        <span>
          {{
            course
              .bankAccount
              .bank_code ||
            ''
          }}
        </span>

        <strong>
          {{
            course
              .bankAccount
              .account_number
          }}
        </strong>
      </div>
    </div>
  </article>
</template>

<style scoped>
.course-card {
  padding: 20px;
  background: #ffffff;
  border: 1px solid #eeeeee;
  border-radius: 24px;
  box-shadow:
    0 8px 24px
    rgb(0 0 0 / 4%);
}

.course-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.course-label,
.progress-header span,
.progress-footer span,
.schedules__title,
.bank-box span {
  color: #999999;
  font-size: 11px;
}

.course-header h2 {
  margin: 5px 0 0;
  font-size: 21px;
}

.course-header p {
  margin: 7px 0 0;
  color: #888888;
  font-size: 11px;
  line-height: 1.6;
}

.cycle-badge {
  flex: 0 0 auto;
  padding: 7px 11px;
  background: #f1f1f1;
  border-radius: 999px;
  color: #666666;
  font-size: 11px;
}

/* ============================================================
   Schedules
   ============================================================ */

.schedules {
  margin-top: 17px;
}

.schedule-list {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 8px;
}

.schedule-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding:
    7px
    10px;
  background: #f5f5f5;
  border-radius: 999px;
  color: #666666;
  font-size: 11px;
}

.schedule-chip--primary {
  background: #222222;
  color: #ffffff;
}

.schedule-chip small {
  opacity: 0.65;
  font-size: 9px;
}

.no-schedule {
  margin-top: 8px;
  color: #aaaaaa;
  font-size: 11px;
}

/* ============================================================
   Package
   ============================================================ */

.no-package {
  margin-top: 18px;
  padding: 15px;
  background: #f7f7f7;
  border-radius: 14px;
}

.no-package strong {
  font-size: 12px;
}

.no-package p {
  margin: 5px 0 0;
  color: #999999;
  font-size: 11px;
}

.progress-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-top: 22px;
}

.progress-header >
div:first-child {
  display: flex;
  flex-direction: column;
}

.progress-header strong {
  margin-top: 4px;
  font-size: 28px;
}

.remaining {
  color: #777777;
  font-size: 12px;
}

.remaining strong {
  margin: 0 3px;
  font-size: 18px;
}

.progress-track {
  height: 9px;
  margin-top: 16px;
  overflow: hidden;
  background: #eeeeee;
  border-radius: 999px;
}

.progress-value {
  height: 100%;
  background: #222222;
  border-radius: inherit;
}

.progress-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
}

/* ============================================================
   Renew
   ============================================================ */

.renew-box {
  margin-top: 15px;
  padding: 14px;
  background: #f7f7f7;
  border-radius: 14px;
}

.renew-box strong {
  font-size: 12px;
}

.renew-box p {
  margin: 5px 0 0;
  color: #777777;
  font-size: 11px;
}

.renew-button {
  width: 100%;
  min-height: 41px;
  margin-top: 12px;
  border: 0;
  background: #222222;
  border-radius: 12px;
  color: #ffffff;
  font-size: 11px;
  font-weight: 600;
}

.renew-button:disabled {
  opacity: 0.55;
}

/* ============================================================
   Bank
   ============================================================ */

.bank-box {
  display: flex;
  justify-content: space-between;
  gap: 15px;
  margin-top: 17px;
  padding-top: 15px;
  border-top: 1px solid #eeeeee;
}

.bank-box > div {
  display: flex;
  flex-direction: column;
}

.bank-box >
div:last-child {
  align-items: flex-end;
}

.bank-box strong {
  margin-top: 4px;
  font-size: 11px;
}
</style>