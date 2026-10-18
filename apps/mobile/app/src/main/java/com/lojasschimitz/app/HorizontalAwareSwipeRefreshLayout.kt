package com.lojasschimitz.app

import android.content.Context
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.ViewConfiguration
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import kotlin.math.abs

/**
 * Pull-to-refresh that never steals a sideways swipe.
 *
 * The stock SwipeRefreshLayout only looks at Y: at the top of the page (home banner carousel)
 * a horizontal swipe with a small downward drift crosses touchSlop, the layout intercepts,
 * the WebView receives ACTION_CANCEL and the banner stops mid-swipe and snaps back. That is the
 * "heavy" carousel felt only inside the app. Here, once the finger moves more sideways than
 * down, the whole gesture belongs to the WebView.
 */
class HorizontalAwareSwipeRefreshLayout @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : SwipeRefreshLayout(context, attrs) {

    private val touchSlop = ViewConfiguration.get(context).scaledTouchSlop
    private var downX = 0f
    private var downY = 0f
    private var horizontalGesture = false

    override fun onInterceptTouchEvent(ev: MotionEvent): Boolean {
        when (ev.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                downX = ev.x
                downY = ev.y
                horizontalGesture = false
            }
            MotionEvent.ACTION_MOVE -> {
                if (horizontalGesture) return false
                val dx = abs(ev.x - downX)
                val dy = abs(ev.y - downY)
                if (HorizontalSwipePolicy.isHorizontal(dx, dy, touchSlop.toFloat())) {
                    horizontalGesture = true
                    return false
                }
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> horizontalGesture = false
        }
        return super.onInterceptTouchEvent(ev)
    }
}

/** Pure rule (unit-testable): sideways once X passes slop and beats Y. */
object HorizontalSwipePolicy {
    fun isHorizontal(dx: Float, dy: Float, touchSlop: Float): Boolean = dx > touchSlop / 2f && dx > dy
}
