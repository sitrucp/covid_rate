

var parseTime = d3.timeParse("%Y-%m-%d");
var selMetric = 'actual';

d3.csv("owid-covid-data.csv", function(d) {
    return {
        location: d.location,
        continent: d.continent,
        date: parseTime(d.date),
        new_cases: d.new_cases,
        new_cases_per_mil: d.new_cases_per_million
        };
}).then(function getData(rawData) {

    
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

    // filter rawData
    var cutoffDate = new Date();
    contFilter = '';
    cutoffDate.setDate(cutoffDate.getDate() - 8);
    if(contFilter == '') {
        filteredData = rawData.filter(function(d) {
            return d.date > cutoffDate && d.location !== 'International';
        })
    } else {
        filteredData = rawData.filter(function(d) {
            return d.date > cutoffDate && d.location !== 'International' && d.continent == contFilter;
        })
    }

    // get min and max date to write to index
    minDate = d3.min(filteredData.map(d=>d.date));
    maxDate = d3.max(filteredData.map(d=>d.date));
    document.getElementById("min_date").innerHTML += minDate.toISOString().split("T")[0];
    document.getElementById("max_date").innerHTML += maxDate.toISOString().split("T")[0];

    // group filteredData by location and mean values
    var data = d3.nest()
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
            avg_new_cases: group.value.avg_new_cases,
            avg_new_cases_per_mil: group.value.avg_new_cases_per_mil
        }
    });

    getData(selMetric);

    function getData() {
        for(var i = 0; i < data.length; i++) {
            if(selMetric == 'actual') {
                var metric = parseInt(data[i].avg_new_cases).toLocaleString("en");
                var cycleDuration = cycleCalc(data[i].avg_new_cases);
            } else {
                var metric = parseInt(data[i].avg_new_cases_per_mil).toLocaleString("en");
                var cycleDuration = cycleCalc(data[i].avg_new_cases_per_mil);
            }
            var location = data[i].location;
            addChart(location, metric, cycleDuration);
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

    function addChart(location, metric, cycleDuration) {
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
        .style("fill", "#FFF")
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


