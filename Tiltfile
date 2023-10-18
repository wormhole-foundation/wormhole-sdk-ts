load('ext://namespace', 'namespace_create', 'namespace_inject')

load('ext://git_resource', 'git_checkout')
git_checkout('git@github.com:wormhole-foundation/wormhole.git#main', 'staging/wormhole')


symbols = load_dynamic('staging/wormhole/Tiltfile')
namespace_create(symbols["namespace"])
k8s_yaml_with_ns = symbols["k8s_yaml_with_ns"]
set_env_in_jobs = symbols["set_env_in_jobs"]
num_guardians = symbols["num_guardians"]
ci_tests = symbols["ci_tests"]
ci_tests = False
print(symbols)

docker_build(
    ref = "sdk-test",
    context = ".",
    dockerfile = "__tests__/Dockerfile",
    only = [],
)

k8s_yaml_with_ns(encode_yaml_stream(set_env_in_jobs(read_yaml_stream("__tests__/tests.yaml"), "NUM_GUARDIANS", str(num_guardians))))


# separate resources to parallelize docker builds
k8s_resource(
    "connect-sdk-ci-tests",
    labels = ["ci"],
    trigger_mode = TRIGGER_MODE_AUTO,
    resource_deps = [], # __tests__/wait-run.sh handles waiting for spy, not having deps gets the build earlier
)