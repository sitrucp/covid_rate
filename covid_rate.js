
var parseTime = d3.timeParse("%Y-%m-%d");
var selMetric = 'actual';
var contFilter = ''; // not implemented but continent filter in future

d3.csv("owid-covid-data.csv", function(d) {
    return {
        location: d.location,
        continent: d.continent,
        date: parseTime(d.date),
        new_cases: d.new_cases,
        new_cases_per_mil: d.new_cases_per_million
        };
}).then(function getData(rawData) {

    // filter rawData past 7 days
    var maxAvailDate = d3.max(rawData.map(d=>d.date));
    var cutOffDate = new Date(maxAvailDate);
    cutOffDate.setDate(cutOffDate.getDate()-7);
    filteredData = rawData.filter(function(d) {
        return d.date > cutOffDate && d.location !== 'International';
    })

    // filter rawData past 14 to 7 days (from maxAvailDate - 14 to maxAvailDate - 7)
    var cutOffDate14days = new Date(maxAvailDate);
    cutOffDate14days.setDate(cutOffDate14days.getDate() - 14);
    filteredDataPast = rawData.filter(function(d) {
        return d.date > cutOffDate14days &&  d.date < cutOffDate && d.location !== 'International';
    })

    // get min and max date to write to index
    minDate = d3.min(filteredData.map(d=>d.date));
    maxDate = d3.max(filteredData.map(d=>d.date));

    document.getElementById("min_date").innerHTML += minDate.toISOString().split("T")[0];
    document.getElementById("max_date").innerHTML += maxDate.toISOString().split("T")[0];
    

    // group filteredData by location and mean values
    var dataCurr = d3.nest()
    .key(function(d) { return d.location; })
    .rollup(function(v) { 
        return {
            avg_new_cases: d3.mean(v, function(d) { return d.new_cases; }),
            avg_new_cases_per_mil: d3.mean(v, function(d) { return d.new_cases_per_mil; })
        };
    })
    .entries(filteredData)
    .map(function(group) {
        return {
            location: group.key,
            avg_new_cases: Math.round(group.value.avg_new_cases),
            avg_new_cases_per_mil: Math.round(group.value.avg_new_cases_per_mil)
        }
    });

    // group filteredDataPast by location and mean values
    var dataPast = d3.nest()
    .key(function(d) { return d.location; })
    .rollup(function(v) { 
        return {
            avg_new_cases_past: d3.mean(v, function(d) { return d.new_cases; }),
            avg_new_cases_per_mil_past: d3.mean(v, function(d) { return d.new_cases_per_mil; })
        };
    })
    .entries(filteredDataPast)
    .map(function(group) {
        return {
            location: group.key,
            avg_new_cases_past: Math.round(group.value.avg_new_cases_past),
            avg_new_cases_per_mil_past: Math.round(group.value.avg_new_cases_per_mil_past)
        }
    });
    
    // left join function used to join data & dataPast
    function equijoinWithDefault(xs, ys, primary, foreign, sel, def) {
        const iy = ys.reduce((iy, row) => iy.set(row[foreign], row), new Map);
        return xs.map(row => typeof iy.get(row[primary]) !== 'undefined' ? sel(row, iy.get(row[primary])): sel(row, def));
    };

    // left join lookup data & dataPast on date
    const data = equijoinWithDefault(
        dataCurr, dataPast, 
        "location", "location", 
        ({location, avg_new_cases, avg_new_cases_per_mil}, {avg_new_cases_past, avg_new_cases_per_mil_past}, ) => 
        ({location, avg_new_cases, avg_new_cases_per_mil, avg_new_cases_past, avg_new_cases_per_mil_past}), 
        {avg_new_cases_past:null, avg_new_cases_per_mil_past:null});

    getData(selMetric);

    function getData() {
        for(var i = 0; i < data.length; i++) {
            if(selMetric == 'actual') {
                var metric = parseInt(data[i].avg_new_cases).toLocaleString("en");
                var metricPast = parseInt(data[i].avg_new_cases_past).toLocaleString("en");
                var cycleDuration = cycleCalc(data[i].avg_new_cases);
            } else {
                var metric = parseInt(data[i].avg_new_cases_per_mil).toLocaleString("en");
                var metricPast = parseInt(data[i].avg_new_cases_per_mil_past).toLocaleString("en");
                var cycleDuration = cycleCalc(data[i].avg_new_cases_per_mil);
            }
            var location = data[i].location;
            addChart(location, metric, metricPast, cycleDuration);
        }
    }

    function cycleCalc(value) {
        if(Math.round(value) < 1) {
            cases = 1; 
        } else {
            cases = value;
        }
        // 24 hours = 86400000 ms
        // cases to duration eg smaller duration is faster
        cycleDuration = (1 / cases) * 86400000;
        return cycleDuration
    }
        
    $("#btn_sort").click(function () {
        d3.selectAll('svg').remove();
        var x = document.getElementById("btn_sort");
        if (x.value === "case") {
            x.innerHTML = "Sort by country";
            x.value = "country";
            if(selMetric === "million") {
                data.sort(function(a, b){return b.avg_new_cases_per_mil - a.avg_new_cases_per_mil});
            } else {
                data.sort(function(a, b){return b.avg_new_cases - a.avg_new_cases});
            }
        } else {
            x.innerHTML = "Sort by cases";
            x.value = "case";
            data.sort(function(a, b) {
                var locA = a.location.toUpperCase();
                var locB = b.location.toUpperCase();
                return (locA < locB) ? -1 : (locA > locB) ? 1 : 0;
            });
        }
        getData();
    });

    $("#btn_metric").click(function () {
        d3.selectAll('svg').remove();
        var x = document.getElementById("btn_metric");
        var p = document.getElementById("text_metric");
        if (x.value === "actual") {
            x.innerHTML = "Actual cases";
            p.innerHTML = "Country by Cases per 1 Million";
            x.value = "million";
            selMetric = 'million';
        } else {
            x.innerHTML = "Cases per 1 million";
            p.innerHTML = "Country by Actual Cases";
            x.value = "actual";
            selMetric = 'actual';
        }
        getData();
    });

    function addChart(location, metric, metricPast, cycleDuration) {
        var width = 700;
        var height = 20;
        var yText = height / 1.3;
        var yShape = height / 2;

        // create svg container
        var svgContainer = d3.select("#svg_container").append("svg")
        .attr("width", width)
        .attr("height", height)
        .style("background-color", function(d) { 
            if(metric == 0) {
                return "#AAAAAA";
            } else {
                return "#4682B4";
            }
            });
        // create svg text location
        var svgTextLocation =  svgContainer.append("text")
        .attr("text-anchor", "start")
        .style("fill", "#FFF")
        .attr("x", 5) // 5px padding from start
        .attr("y", yText)
        .text(location);

        // create svg text metric (new cases, new cases per mil)
        var svgTextMetric =  svgContainer.append("text")
        .attr("text-anchor", "end")
        .style("fill", "#FFF")
        .attr("x", width - 5) // 5px padding from end
        .attr("y", yText)
        .text(metric);

        // create svg shape
        var svgShape = svgContainer.append("circle")
        .style("stroke", "#FFF")
       	.style("stroke-width", 2)
        .style("fill", function(d) { 
            if(metric < metricPast) {
                return "#6FC628";
            } else if (metric > metricPast) {
                return "#C62858";
            } else {
                return "#FFF";
            }
        })
        .attr("cy", yShape)
        .attr("r", 5);

        var counter = 0;

        repeat();
        
        // repeat transition endless loop
        function repeat() {
            svgShape
            .attr("cx", 150)
            .transition()
            .duration(cycleDuration)
            .ease(d3.easeLinear)
            .attr("cx", 600)
            .transition()
            .duration(1)
            .attr("cx", 150)
            .on("end", repeat);
            
            svgTextMetric
            .text(counter + ' / ' + metric);
            counter++;
          };

    }

});


