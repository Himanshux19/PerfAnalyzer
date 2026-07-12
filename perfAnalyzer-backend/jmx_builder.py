import json
from urllib.parse import urlparse
from xml.dom import minidom
from xml.etree import ElementTree as ET
from typing import List

from models import CreateTestRequest, ApiRequest


def _sub(parent, tag, **attrs):
    return ET.SubElement(parent, tag, attrs)


def _string_prop(parent, name, value):
    el = ET.SubElement(parent, "stringProp", {"name": name})
    el.text = "" if value is None else str(value)
    return el


def _bool_prop(parent, name, value: bool):
    el = ET.SubElement(parent, "boolProp", {"name": name})
    el.text = "true" if value else "false"
    return el


def _int_prop(parent, name, value: int):
    el = ET.SubElement(parent, "intProp", {"name": name})
    el.text = str(value)
    return el


def _hash_tree(parent):
    return ET.SubElement(parent, "hashTree")


def _build_header_manager(parent_ht, headers: dict):
    """Adds a HeaderManager sampler config + its (empty) hashTree."""
    hm = _sub(
        parent_ht,
        "HeaderManager",
        guiclass="HeaderPanel",
        testclass="HeaderManager",
        testname="HTTP Header Manager",
        enabled="true",
    )
    coll = ET.SubElement(hm, "collectionProp", {"name": "HeaderManager.headers"})
    for name, value in headers.items():
        el_prop = ET.SubElement(coll, "elementProp", {"name": name, "elementType": "Header"})
        _string_prop(el_prop, "Header.name", name)
        _string_prop(el_prop, "Header.value", value)
    _hash_tree(parent_ht)


def _build_http_sampler(parent_ht, api_req: ApiRequest):
    parsed_url = urlparse(api_req.url)
    scheme = parsed_url.scheme or "https"
    domain = parsed_url.hostname or ""
    port = parsed_url.port
    path = parsed_url.path or "/"
    if parsed_url.query:
        path = f"{path}?{parsed_url.query}"

    sampler_name = api_req.name or f"{api_req.method} {path}"
    sampler = _sub(
        parent_ht,
        "HTTPSamplerProxy",
        guiclass="HttpTestSampleGui",
        testclass="HTTPSamplerProxy",
        testname=sampler_name,
        enabled="true",
    )

    body_json = None
    if api_req.body:
        body_json = json.dumps(api_req.body)

    # Arguments (POST body / query args)
    args_element = ET.SubElement(
        sampler, "elementProp", {"name": "HTTPsampler.Arguments", "elementType": "Arguments"}
    )
    args_coll = ET.SubElement(args_element, "collectionProp", {"name": "Arguments.arguments"})
    if body_json is not None:
        arg = ET.SubElement(
            args_coll, "elementProp", {"name": "", "elementType": "HTTPArgument"}
        )
        _bool_prop(arg, "HTTPArgument.always_encode", False)
        _string_prop(arg, "Argument.value", body_json)
        _string_prop(arg, "Argument.metadata", "=")

    _string_prop(sampler, "HTTPSampler.domain", domain)
    _string_prop(sampler, "HTTPSampler.port", str(port) if port else "")
    _string_prop(sampler, "HTTPSampler.protocol", scheme)
    _string_prop(sampler, "HTTPSampler.path", path)
    _string_prop(sampler, "HTTPSampler.method", api_req.method)
    _bool_prop(sampler, "HTTPSampler.follow_redirects", True)
    _bool_prop(sampler, "HTTPSampler.auto_redirects", False)
    _bool_prop(sampler, "HTTPSampler.use_keepalive", True)
    _bool_prop(sampler, "HTTPSampler.DO_MULTIPART_POST", False)
    if body_json is not None:
        _bool_prop(sampler, "HTTPSampler.postBodyRaw", True)
    _string_prop(sampler, "HTTPSampler.connect_timeout", "")
    _string_prop(sampler, "HTTPSampler.response_timeout", "")

    sampler_ht = _hash_tree(parent_ht)

    if api_req.headers:
        _build_header_manager(sampler_ht, api_req.headers)

    return sampler


def _build_result_collector(parent_ht, name, testname, gui_class):
    rc = _sub(
        parent_ht,
        "ResultCollector",
        guiclass=gui_class,
        testclass="ResultCollector",
        testname=testname,
        enabled="true",
    )
    _bool_prop(rc, "ResultCollector.error_logging", False)
    obj_prop = ET.SubElement(rc, "objProp")
    ET.SubElement(obj_prop, "name").text = "saveConfig"
    value = ET.SubElement(obj_prop, "value", {"class": "SampleSaveConfiguration"})
    for tag in (
        "time", "latency", "timestamp", "success", "label", "code", "message",
        "threadName", "dataType", "encoding", "assertions", "subresults",
        "responseData", "samplerData", "xml", "fieldNames", "responseHeaders",
        "requestHeaders", "responseDataOnError", "saveAssertionResultsFailureMessage",
        "bytes", "threadCounts", "sentBytes",
    ):
        ET.SubElement(value, tag).text = "true"
        ET.SubElement(value, "assertionsResultsToSave").text = "0"
    _string_prop(rc, "filename", "")
    _hash_tree(parent_ht)


def build_jmx(request: CreateTestRequest, api_requests: List[ApiRequest]) -> str:
    api_requests_objs = []
    for req in api_requests:
        if isinstance(req, dict):
            api_requests_objs.append(ApiRequest(**req))
        else:
            api_requests_objs.append(req)

    root = ET.Element("jmeterTestPlan", {"version": "1.2", "properties": "5.0", "jmeter": "5.6.3"})
    root_ht = _hash_tree(root)

    # ---- TestPlan ----
    test_plan = _sub(
        root_ht,
        "TestPlan",
        guiclass="TestPlanGui",
        testclass="TestPlan",
        testname=request.testName,
        enabled="true",
    )
    _string_prop(test_plan, "TestPlan.comments", "Generated automatically by PerfAnalyzer")
    _bool_prop(test_plan, "TestPlan.functional_mode", False)
    _bool_prop(test_plan, "TestPlan.tearDown_on_shutdown", True)
    _bool_prop(test_plan, "TestPlan.serialize_threadgroups", False)

    user_defined_vars = ET.SubElement(
        test_plan,
        "elementProp",
        {
            "name": "TestPlan.user_defined_variables",
            "elementType": "Arguments",
            "guiclass": "ArgumentsPanel",
            "testclass": "Arguments",
            "testname": "User Defined Variables",
            "enabled": "true",
        },
    )
    ET.SubElement(user_defined_vars, "collectionProp", {"name": "Arguments.arguments"})
    _string_prop(test_plan, "TestPlan.user_define_classpath", "")

    test_plan_ht = _hash_tree(root_ht)

    # ---- ThreadGroup ----
    thread_group = _sub(
        test_plan_ht,
        "ThreadGroup",
        guiclass="ThreadGroupGui",
        testclass="ThreadGroup",
        testname=f"{request.testName} - Thread Group",
        enabled="true",
    )
    _string_prop(thread_group, "ThreadGroup.on_sample_error", "continue")

    loop_controller = ET.SubElement(
        thread_group,
        "elementProp",
        {
            "name": "ThreadGroup.main_controller",
            "elementType": "LoopController",
            "guiclass": "LoopControlPanel",
            "testclass": "LoopController",
            "testname": "Loop Controller",
            "enabled": "true",
        },
    )
    _bool_prop(loop_controller, "LoopController.continue_forever", request.loopCount == -1)
    _int_prop(loop_controller, "LoopController.loops", request.loopCount)

    _string_prop(thread_group, "ThreadGroup.num_threads", request.threads)
    _string_prop(thread_group, "ThreadGroup.ramp_time", request.rampUp)
    _bool_prop(thread_group, "ThreadGroup.scheduler", True)
    _string_prop(thread_group, "ThreadGroup.duration", request.duration)
    _string_prop(thread_group, "ThreadGroup.delay", "0")
    _bool_prop(thread_group, "ThreadGroup.same_user_on_next_iteration", True)

    thread_group_ht = _hash_tree(test_plan_ht)

    # ---- HTTP Samplers (+ Header Managers) ----
    for api_req in api_requests_objs:
        _build_http_sampler(thread_group_ht, api_req)

    # ---- Listeners (basic result collectors so bzt/JMeter has output) ----
    _build_result_collector(
        thread_group_ht, "view-results-tree", "View Results Tree", "ViewResultsFullVisualizer"
    )
    _build_result_collector(
        thread_group_ht, "summary-report", "Summary Report", "SummaryReport"
    )

    xml_bytes = ET.tostring(root, encoding="utf-8")
    pretty = minidom.parseString(xml_bytes).toprettyxml(indent="  ", encoding="UTF-8")
    return pretty.decode("utf-8")