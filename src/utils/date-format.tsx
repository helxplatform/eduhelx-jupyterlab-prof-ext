import React, { Fragment, ReactNode, useEffect, useState } from 'react'
import moment, { Moment, duration } from 'moment'
interface IDateFormat {
    // E.g. Mar 5 at 11:59 PM
    toBasicDatetime(year?: boolean, time?: boolean): string
    // E.g. 03/05/2024 at 11:59 PM
    toNumberDatetime(time?: boolean): string
    // E.g. "3 months, 2 weeks" or "an hour"
    toRelativeDatetime(
        referenceTime?: Date,
        postprocess?: (humanizedDuration: string) => string
    ): ReactNode | string
    // Same as toRelativeDatetime but never substitutes articles.
    // E.g. "3 months, 2 weeks" or "1 hour"
    toRelativeDatetimeNoArticle(
        referenceTime?: Date,
        postprocess?: (humanizedDuration: string) => string
    ): ReactNode | string
}

const ReactiveTime = ({ getTime }: { getTime: () => string }) => {
    const [time, setTime] = useState<string>(getTime())
    useEffect(() => {
        // Doesn't need to precisely sync to the internal time or anything
        // because the humanized moment is imprecise. 
        const interval = window.setInterval(() => {
            setTime(getTime())
        }, 1000)
        return () => {
            window.clearInterval(interval)
        }
    }, [])
    return <Fragment>{ time }</Fragment>
}

export function getLocalTimezoneOffset(): number {
    return new Date().getTimezoneOffset()
}

export function getLocalTimezoneOffsetText(returnZ=true): string {
    const offset = -getLocalTimezoneOffset()
    if (returnZ && offset === 0) return "Z"

    const sign = offset >= 0 ? "+" : "-"
    const offsetHr = Math.floor(Math.abs(offset) / 60).toString().padStart(2, "0")
    const offsetMin = (Math.abs(offset) % 60).toString().padStart(2, "0")
    return `${ sign }${ offsetHr }:${ offsetMin }`
}

export function getLocalTimezoneFullname(): string {
    return new Date().toLocaleTimeString(undefined, { timeZoneName: "long" }).split(" ").slice(2).join(" ")
}

export function getLocalTimezoneAbbr(): string {
    return new Date().toLocaleTimeString(undefined, { timeZoneName: 'short' }).split(" ")[2]
}

export function addLocalTimezone(datetimeWithoutTz: string, returnZ=true): string {
    return datetimeWithoutTz + getLocalTimezoneOffsetText(returnZ)
}

// The purpose of this is to standardize the date string formats used across the project.
export class DateFormat implements IDateFormat {
    private _date: Date
    private _moment: Moment
    constructor(date: Date) {
        this._date = date
        this._moment = moment(date)
    }

    get date(): Date {
        return this._date
    }

    get moment(): Moment {
        return this._moment
    }

    toBasicDatetime(year: boolean=false, time: boolean=true): string {
        `MMM DD, 2024`
        return this._moment.format(`MMM DD${ year ? "," : "" } ${ year ? "YYYY " : "" }${ time ? "[at] h[:]mm A" : "" }`)
    }

    toNumberDatetime(time: boolean=true): string {
        return this._moment.format(`MM/DD/YYYY ${ time ? "[at] h[:]mm A" : "" }`)
    }

    toRelativeDatetime(
        referenceTime?: Date,
        postprocess?: (humanizedDuration: string) => string
    ): ReactNode | string {
        if (!postprocess) postprocess = (s: string) => s
        // For whatever reason TSC type-narrowing is completely broken here and still considers postprocess possibly undefined...
        const getDuration = (date: Date) => postprocess!(duration(this._moment.diff(moment(date))).humanize())
        
        // const getDuration = (date: Date) => postprocess(duration(this._moment.diff(moment(date))).humanize())
        if (referenceTime) return getDuration(referenceTime)
        return <ReactiveTime getTime={ () => getDuration(new Date()) } />
    }

    toRelativeDatetimeNoArticle(
        referenceTime?: Date,
        postprocess?: (humanizedDuration: string) => string
    ): ReactNode | string {
        if (!postprocess) postprocess = (s: string) => s
        const removeArticle = (s: string) => {
            if (s.startsWith("a ")) return "1 " + s.substring(2)
            if (s.startsWith("an ")) return "1 " + s.substring(3)
            return s
        }
        // For whatever reason TSC type-narrowing is completely broken here and still considers postprocess possibly undefined...
        return this.toRelativeDatetime(referenceTime, (s) => postprocess!(removeArticle(s)))
    }
}