const unique_dates = (dates: Date[]) => {
    let uniqueArray = dates
        .map(function (date) { return date.getTime() })
        .filter(function (date, i, array) {
            return array.indexOf(date) === i;
        })
        .map(function (time) { return new Date(time); });

    return uniqueArray
}

export default unique_dates;